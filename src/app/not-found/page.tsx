import NotFound from '../not-found';

/**
 * Addressable not-found page. The middleware rewrites here with an explicit 404
 * status for routes it gates, since a rewrite needs a real route to land on.
 */
export default function NotFoundRoute() {
  return <NotFound />;
}
