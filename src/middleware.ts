type MiddlewareNext = () => Promise<Response> | Response;

export function onRequest(_context: unknown, next: MiddlewareNext): Promise<Response> | Response {
  return next();
}
