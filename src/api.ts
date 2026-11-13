export class ApiError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}, public status = 0) {super(message);}
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {response = await fetch(`/api${path}`, {...options, headers: {'Content-Type': 'application/json', ...options.headers}});}
  catch (error) {if ((error as Error).name === 'AbortError') throw error; throw new ApiError('Atölyeye bağlanılamadı. Bağlantıyı kontrol edip tekrar deneyin.');}
  let body;
  try {body = await response.json();} catch {throw new ApiError('Atölyeden geçerli yanıt alınamadı. Yeniden deneyin.', {}, response.status);}
  if (!response.ok) throw new ApiError(body.error || 'İşlem tamamlanamadı.', body.fields, response.status);
  return body as T;
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'Beklenmeyen bir sorun oluştu.';
