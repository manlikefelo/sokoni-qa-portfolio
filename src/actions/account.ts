'use server';

import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { db } from '@/lib/db';
import { signIn } from '@/lib/auth';
import { requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { readGuestToken, mergeGuestCartIntoUserCart, clearGuestToken } from '@/lib/cart';
import { registerSchema, loginSchema, changePasswordSchema } from '@/schemas/auth';
import { addressSchema } from '@/schemas/address';

export interface AccountResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * One message for every authentication failure. Telling a caller that an email is
 * unknown, or that a password was wrong for a known email, hands them a way to
 * enumerate accounts.
 */
const GENERIC_AUTH_FAILURE = 'Those credentials are not valid.';
const GENERIC_REGISTER_FAILURE = 'That account could not be created.';

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export async function registerAction(formData: FormData): Promise<AccountResult> {
  const ip = await getRequestIp();
  const limit = checkRateLimit(`register:${ip}`);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    // Deliberately the same message a genuine failure produces.
    return { ok: false, message: GENERIC_REGISTER_FAILURE };
  }

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  return { ok: true, message: 'Your account is ready. Sign in to continue.' };
}

export async function loginAction(formData: FormData): Promise<AccountResult> {
  const ip = await getRequestIp();
  const limit = checkRateLimit(`login:${ip}`);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { ok: false, message: GENERIC_AUTH_FAILURE };

  // The guest token is read before sign-in, because signing in swaps which cart
  // the helpers resolve to.
  const guestToken = await readGuestToken();

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: GENERIC_AUTH_FAILURE };
    throw error;
  }

  resetRateLimit(`login:${ip}`);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user && guestToken) {
    await mergeGuestCartIntoUserCart(user.id, guestToken);
    await clearGuestToken();
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function changePasswordAction(formData: FormData): Promise<AccountResult> {
  const session = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return { ok: false, message: 'That account could not be found.' };

  const valid = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    return {
      ok: false,
      message: 'Your current password is not correct.',
      fieldErrors: { currentPassword: 'Your current password is not correct.' },
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return { ok: true, message: 'Your password has been changed.' };
}

export async function saveAddressBookAction(formData: FormData): Promise<AccountResult> {
  const session = await requireUser();

  const addressId = formData.get('addressId');
  const parsed = addressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Check the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const data = {
    line1: parsed.data.line1,
    line2: parsed.data.line2 || null,
    city: parsed.data.city,
    county: parsed.data.county,
    postalCode: parsed.data.postalCode,
    phone: parsed.data.phone,
    isDefault: parsed.data.isDefault,
  };

  await db.$transaction(async (tx) => {
    // Exactly one address per user carries the default flag.
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId: session.id }, data: { isDefault: false } });
    }

    if (typeof addressId === 'string' && addressId.length > 0) {
      // Scoped by userId so an id belonging to someone else simply matches nothing.
      const updated = await tx.address.updateMany({
        where: { id: addressId, userId: session.id },
        data,
      });
      if (updated.count === 0) throw new Error('ADDRESS_NOT_FOUND');
      return;
    }

    const count = await tx.address.count({ where: { userId: session.id } });
    await tx.address.create({
      data: { ...data, userId: session.id, isDefault: data.isDefault || count === 0 },
    });
  });

  revalidatePath('/account/addresses');
  return { ok: true, message: 'Address saved.' };
}

export async function deleteAddressAction(formData: FormData): Promise<AccountResult> {
  const session = await requireUser();
  const addressId = formData.get('addressId');
  if (typeof addressId !== 'string' || addressId.length === 0) {
    return { ok: false, message: 'No address selected.' };
  }

  const deleted = await db.address.deleteMany({
    where: { id: addressId, userId: session.id },
  });
  if (deleted.count === 0) return { ok: false, message: 'That address could not be found.' };

  // If the default went with it, promote whatever remains.
  const remaining = await db.address.findFirst({
    where: { userId: session.id },
    orderBy: { id: 'asc' },
  });
  if (remaining) {
    const hasDefault = await db.address.count({
      where: { userId: session.id, isDefault: true },
    });
    if (hasDefault === 0) {
      await db.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
    }
  }

  revalidatePath('/account/addresses');
  return { ok: true, message: 'Address removed.' };
}

export async function setDefaultAddressAction(formData: FormData): Promise<AccountResult> {
  const session = await requireUser();
  const addressId = formData.get('addressId');
  if (typeof addressId !== 'string' || addressId.length === 0) {
    return { ok: false, message: 'No address selected.' };
  }

  const owned = await db.address.findFirst({ where: { id: addressId, userId: session.id } });
  if (!owned) return { ok: false, message: 'That address could not be found.' };

  await db.$transaction([
    db.address.updateMany({ where: { userId: session.id }, data: { isDefault: false } }),
    db.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);

  revalidatePath('/account/addresses');
  return { ok: true, message: 'Default address updated.' };
}
