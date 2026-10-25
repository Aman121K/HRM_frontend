const platformBackendOrigin=(process.env.NEXT_PUBLIC_PLATFORM_API_URL||"http://localhost:4100").replace(/\/$/,"");
/** Absolute URL on the v2 platform API (the only backend the web app talks to). */
export function platformApiUrl(path:string){return `${platformBackendOrigin}${path.startsWith("/")?path:`/${path}`}`}
