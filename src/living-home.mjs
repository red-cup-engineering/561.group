import { createLivingWebServer } from "@red-cup-engineering/living-web-server/fetch";
import { project561GroupPage, project561GroupHead, PUBLIC_ROUTES } from "./home-tufte.mjs";

export { PUBLIC_ROUTES } from "./home-tufte.mjs";

/**
 * One real public LivingWebServer application. Each request authorizes and
 * reads original institution, estate and public-editorial sources. The
 * caller's Worker owns HTTP routing and ActivityPub remains its own provider.
 */
export function create561GroupLivingApplication({
  readHome, readEstate, readFrontdoor, releaseHome
} = {}) {
  for (const [name, reader] of Object.entries({readHome,readEstate,readFrontdoor})) {
    if (typeof reader !== "function")
      throw new TypeError("Original " + name + " source reader is required");
  }
  const read = async (context, path) => {
    const [home,estate,frontdoor] = await Promise.all([
      readHome(context),readEstate(context),readFrontdoor(context)
    ]);
    return project561GroupPage({home,estate,frontdoor,path});
  };
  const permitted = new Set(["home","work","audit","projects","about","agents"]);
  return createLivingWebServer({
    origin:"https://561.group",
    document:{headHtml:project561GroupHead(releaseHome)},
    authorizePublicRead:({resource,context}) =>
      permitted.has(resource) && ["GET","HEAD"].includes(context.request.method),
    home:context => read(context,"/"),
    pages:[
      {match:"/work/",name:"work",read:context => read(context,"/work/")},
      {match:"/work/audit/",name:"audit",read:context => read(context,"/work/audit/")},
      {match:"/projects/",name:"projects",read:context => read(context,"/projects/")},
      {match:"/about/",name:"about",read:context => read(context,"/about/")},
      {match:"/for-agents/",name:"agents",read:context => read(context,"/for-agents/")}
    ]
  });
}
