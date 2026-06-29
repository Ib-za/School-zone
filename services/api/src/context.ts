export type ApiContext = {
  request: Request;
};

export function createContext(request: Request): ApiContext {
  return { request };
}
