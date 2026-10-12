/** SQLite has one writer; queue on the pool instead of blocking Prisma's native workers. */
export function sqliteUrlWithSingleConnection(url: string): string {
  if (!/^(?:file|sqlite):/.test(url)) return url;
  const separator = url.indexOf("?");
  const database = separator < 0 ? url : url.slice(0, separator);
  const parameters = separator < 0 ? [] : url.slice(separator + 1).split("&")
    .filter((parameter) => parameter && parameter.split("=", 1)[0] !== "connection_limit");
  return `${database}?${[...parameters, "connection_limit=1"].join("&")}`;
}
