// Hilo y Mapa · comportamiento de la web (sin dependencias, sin cookies, sin rastreo).
document.documentElement.classList.add("js");

// Reproductor: YouTube (sin cookies) solo al pulsar. Los capítulos saltan a su minuto en el mismo reproductor.
const cargar = (rep, inicio = 0) => {
  const id = rep.dataset.id;
  let f = rep.querySelector("iframe");
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${inicio ? `&start=${inicio}` : ""}`;
  if (f) { f.src = src; return; }
  f = document.createElement("iframe");
  f.src = src; f.title = rep.dataset.titulo || "Vídeo de Hilo y Mapa";
  f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
  rep.appendChild(f); rep.classList.add("cargado");
};
document.querySelectorAll(".reproductor").forEach((rep) => rep.addEventListener("click", () => cargar(rep), { once: true }));
const repCaso = document.querySelector(".reproductor-caso");
if (repCaso) document.querySelectorAll("[data-t]").forEach((a) => a.addEventListener("click", (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return; // con modificadores, abre YouTube como un enlace normal
  e.preventDefault();
  cargar(repCaso, +a.dataset.t);
  repCaso.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}));

// Aparición al entrar en pantalla.
const obs = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }) : null;
document.querySelectorAll(".revelar").forEach((el) => (obs ? obs.observe(el) : el.classList.add("visible")));

// Mapa de casos: al pasar por un caso de la leyenda (o enfocarlo), se ilumina su hilo.
const mapa = document.querySelector(".mapa-casos");
if (mapa) document.querySelectorAll(".leyenda a").forEach((a) => {
  const on = () => { mapa.classList.add("enfocado"); mapa.querySelectorAll(".ruta").forEach((r) => r.classList.toggle("activa", r.dataset.caso === a.dataset.caso)); };
  const off = () => mapa.classList.remove("enfocado");
  a.addEventListener("mouseenter", on); a.addEventListener("focus", on);
  a.addEventListener("mouseleave", off); a.addEventListener("blur", off);
});
