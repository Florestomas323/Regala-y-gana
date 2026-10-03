/* Rutas:
   /  y  /regalaygana   → crear y compartir enlace (QR del stand)
   /r/CODIGO            → la persona que recibe el regalo
   /regalo?ref=CODIGO   → lo mismo (alternativa)
   /panel               → consulta privada
   /privacidad, /terminos */
import CreateLink from "./CreateLink.jsx";
import Gift from "./Gift.jsx";
import Panel from "./Panel.jsx";
import Legal from "./Legal.jsx";
import { Brand, Footer } from "./ui.jsx";

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const m = path.match(/^\/r\/([^/]+)$/i);
  if (m) return <Gift code={decodeURIComponent(m[1])} />;
  if (path === "/regalo") return <Gift code={new URLSearchParams(window.location.search).get("ref") || ""} />;
  if (path === "/" || path === "/regalaygana") return <CreateLink />;
  if (path === "/panel") return <Panel />;
  if (path === "/privacidad" || path === "/terminos") return <Legal page={path.slice(1)} />;
  return (
    <div className="page"><main className="wrap"><section className="card center">
      <Brand small /><h1 className="h2">Página no encontrada</h1>
      <a className="btn btn-primary" href="/regalaygana">IR A REGALA Y GANA</a>
    </section></main><Footer /></div>
  );
}
