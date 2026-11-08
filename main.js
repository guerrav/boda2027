// ===== Configuración: cambia estos valores =====
const CONFIG = {
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbx0BHfe-NvhdWwopCYVjh3pUDv6zW2qx7xFyWYrN8NHKEvarfqSF9f_iQVFJPEnygGkdQ/exec",     // recomendado: URL que recibe las respuestas (Formspree, Google Apps Script, etc.)
  rsvpWhatsapp: "",     // alternativa: número con lada, sin "+" ni espacios, ej. "5215512345678"
  rsvpEmail: ""         // alternativa: correo que recibirá las confirmaciones
};

// ===== Menú móvil =====
const nav = document.getElementById("nav");
nav.querySelector(".nav-toggle").addEventListener("click", e => {
  const open = nav.classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

// ===== Efecto cortina =====
// Cada sección es una tarjeta fija: sube y se lleva su sombra mientras la siguiente
// queda quieta debajo. Sin JS (o con "reducir movimiento") las secciones van en flujo normal.
(function () {
  const secs = [...document.querySelectorAll("#curtains > section")];
  const links = [...nav.querySelectorAll("a")];
  const linkById = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let on = false, starts = [], heights = [], spacer = null, ticking = false, hold = 0;

  // "Pausa": al llegar a una sección, se necesitan unos cuantos scrolls más
  // antes de que la cortina empiece a subir (da tiempo de leer).
  function measure() {
    hold = Math.round(Math.min(620, Math.max(340, innerHeight * 0.7)));
    heights = secs.map(s => s.offsetHeight);
    let acc = 0;
    starts = heights.map((h, i) => { const s = acc; acc += h + (i < secs.length - 1 ? hold : 0); return s; });
    spacer.style.height = acc + "px";
  }

  function update() {
    ticking = false;
    const y = window.scrollY;
    let cur = 0;
    starts.forEach((s, i) => { if (y >= s - 1) cur = i; });
    secs.forEach((s, i) => {
      const visible = i === cur || i === cur + 1;
      s.style.visibility = visible ? "visible" : "hidden";
      s.style.zIndex = secs.length - i;
      const lift = i === cur ? Math.max(0, y - starts[i] - (i < secs.length - 1 ? hold : 0)) : 0;
      s.style.transform = `translate3d(0, ${-lift}px, 0)`;
    });
    links.forEach(l => l.classList.remove("active"));
    linkById.get(secs[cur].id)?.classList.add("active");
  }

  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

  function enable() {
    if (on) return;
    on = true;
    document.documentElement.classList.add("curtains");
    spacer = document.createElement("div");
    spacer.id = "curtain-spacer"; spacer.setAttribute("aria-hidden", "true");
    document.getElementById("curtains").after(spacer);
    measure(); update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", () => { measure(); request(); });
    addEventListener("load", () => { measure(); request(); });
    document.fonts?.ready.then(() => { measure(); request(); });
    if ("ResizeObserver" in window) { const ro = new ResizeObserver(() => { measure(); request(); }); secs.forEach(s => ro.observe(s)); }
    if (location.hash) jump(location.hash.slice(1), false);
  }

  function disable() {
    if (!on) return;
    location.reload();   // la forma más simple de volver al flujo normal
  }

  function jump(id, smooth = true) {
    const i = secs.findIndex(s => s.id === id);
    if (i < 0) return;
    scrollTo({ top: starts[i], behavior: smooth ? "smooth" : "instant" });
  }

  nav.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a || !on) return;
    e.preventDefault(); jump(a.getAttribute("href").slice(1));
    history.replaceState(null, "", a.getAttribute("href"));
  });

  if (!reduce.matches) enable();
  reduce.addEventListener?.("change", () => { if (reduce.matches) disable(); else enable(); });

  // Sin cortina: enlace activo por IntersectionObserver
  if (!on) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { links.forEach(l => l.classList.remove("active")); linkById.get(en.target.id)?.classList.add("active"); }
    }), { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach(s => io.observe(s));
  }
})();

// ===== Itinerario: la línea de tiempo cambia la tarjeta =====
(function () {
  const slides = [...document.querySelectorAll("#schedule .sched-slide")];
  const tabs = [...document.querySelectorAll("#schedule-tabs li")];
  tabs.forEach((t, k) => t.querySelector("button").addEventListener("click", () => {
    slides.forEach((s, i) => s.classList.toggle("active", i === k));
    document.querySelectorAll("#itinerario .sched-bg").forEach((bg, i) => bg.classList.toggle("on", i === k));
    tabs.forEach((x, i) => x.classList.toggle("active", i === k));
  }));
})();

// ===== RSVP: buscar nombre -> ver lugares -> elegir =====
(function () {
  const root = document.getElementById("rsvp-app");
  if (!root) return;
  const $ = id => document.getElementById(id);
  const steps = Object.fromEntries([...root.querySelectorAll("[data-step]")].map(s => [s.dataset.step, s]));
  const input = $("rsvp-search"), results = $("rsvp-results"), hint = $("rsvp-hint");
  const choices = [...root.querySelectorAll(".rsvp-choice")];
  const sendBtn = $("rsvp-send"), status = $("rsvp-status");
  let data = window.INVITADOS || [];   // respaldo; se reemplaza con la pestaña "Invitados" del Google Sheet
  let guest = null, answer = null, count = 1;

  const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const show = name => { Object.entries(steps).forEach(([k, el]) => { el.hidden = k !== name; }); };

  // --- Paso 1: búsqueda ---
  function search() {
    const q = norm(input.value);
    results.innerHTML = ""; hint.textContent = "";
    if (q.length < 2) return;
    const tokens = q.split(" ");
    const found = data.filter(g => {
      const words = norm(g.nombre + " " + (g.incluye || "")).split(" ");
      return tokens.every(tk => words.some(w => w.startsWith(tk)));
    }).slice(0, 6);
    if (!found.length) {
      hint.textContent = "No encontramos ese nombre. Revisa cómo aparece en tu invitación o escríbenos y con gusto te ayudamos.";
      return;
    }
    found.forEach(g => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "option"); b.textContent = g.nombre;
      if (g.incluye) { const s = document.createElement("small"); s.textContent = g.incluye; b.appendChild(s); }
      b.addEventListener("click", () => pick(g));
      li.appendChild(b); results.appendChild(li);
    });
  }
  input.addEventListener("input", search);

  // Lista de invitados desde Google Sheets (pestaña "Invitados"); si falla, se usa invitados.js
  if (CONFIG.rsvpEndpoint) {
    fetch(CONFIG.rsvpEndpoint + "?lista=1").then(r => r.json()).then(d => {
      if (d && d.ok && Array.isArray(d.invitados) && d.invitados.length) {
        data = d.invitados.map(g => g.incluye ? g : { nombre: g.nombre, lugares: g.lugares });
        if (norm(input.value).length >= 2) search();
      }
    }).catch(() => {});
  }
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); results.querySelector("button")?.click(); }
    if (e.key === "ArrowDown") { e.preventDefault(); results.querySelector("button")?.focus(); }
  });

  // --- Paso 2: responder ---
  function pick(g) {
    guest = g; answer = null; count = g.lugares;
    $("rsvp-name").textContent = g.nombre;
    $("rsvp-seats").innerHTML = g.lugares === 1
      ? "Tienes <strong>un lugar</strong> reservado para ti (sin acompañantes)."
      : `Tienes <strong>${g.lugares} lugares</strong> reservados para ti.`;
    const inc = $("rsvp-incluye");
    inc.textContent = g.incluye ? "Invitación para: " + g.incluye : ""; inc.hidden = !g.incluye;
    root.querySelector('[data-answer="yes"] .rsvp-choice-text').textContent = g.lugares > 1 ? "Con gusto asistiremos" : "Con gusto asistiré";
    root.querySelector('[data-answer="no"] .rsvp-choice-text').textContent = g.lugares > 1 ? "No podremos asistir" : "No podré asistir";
    choices.forEach(c => c.setAttribute("aria-pressed", "false"));
    $("rsvp-count").hidden = true; $("rsvp-notes").hidden = true; $("rsvp-comments").value = "";
    sendBtn.disabled = true; status.textContent = ""; sendBtn.textContent = "Enviar confirmación";
    const prev = $("rsvp-prev"); prev.hidden = true;
    show("respond");
    loadPrevious(g);
  }

  // Si esta invitación ya respondió antes, lo avisa y precarga su respuesta
  async function loadPrevious(g) {
    if (!CONFIG.rsvpEndpoint) return;
    try {
      const r = await fetch(CONFIG.rsvpEndpoint + "?nombre=" + encodeURIComponent(g.nombre));
      const d = await r.json();
      if (guest !== g || !d.found) return;
      const yes = /^s/i.test(d.respuesta);
      const f = new Date(d.fecha);
      const fecha = isNaN(f) ? "" : " el " + f.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      const prev = $("rsvp-prev");
      prev.textContent = `Ya confirmaste${fecha}: ${yes ? "asistirás" + (g.lugares > 1 ? " (" + d.asistentes + " de " + g.lugares + " personas)" : "") : "no podrás asistir"}. Si quieres, puedes cambiar tu respuesta y volver a enviarla.`;
      prev.hidden = false;
      if (answer === null) {
        choices.find(c => c.dataset.answer === (yes ? "yes" : "no")).click();
        if (yes && g.lugares > 1) { count = Math.min(Math.max(Number(d.asistentes) || g.lugares, 1), g.lugares); buildPills(); }
        $("rsvp-comments").value = d.comentarios || "";
        sendBtn.textContent = "Actualizar confirmación";
      }
    } catch (err) { /* sin conexión o sin respuesta previa: se muestra el formulario normal */ }
  }

  function buildPills() {
    const box = $("rsvp-pills"); box.innerHTML = "";
    for (let n = 1; n <= guest.lugares; n++) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = n;
      b.setAttribute("aria-pressed", String(n === count));
      b.addEventListener("click", () => { count = n; [...box.children].forEach((x, i) => x.setAttribute("aria-pressed", String(i + 1 === n))); });
      box.appendChild(b);
    }
  }

  choices.forEach(c => c.addEventListener("click", () => {
    answer = c.dataset.answer;
    choices.forEach(x => x.setAttribute("aria-pressed", String(x === c)));
    const many = guest.lugares > 1 && answer === "yes";
    if (many) { count = guest.lugares; buildPills(); }
    $("rsvp-count").hidden = !many;
    $("rsvp-notes").hidden = answer !== "yes";
    sendBtn.disabled = false; status.textContent = "";
  }));

  $("rsvp-back").addEventListener("click", () => { guest = null; input.value = ""; results.innerHTML = ""; hint.textContent = ""; show("search"); input.focus(); });
  $("rsvp-change").addEventListener("click", () => { pick(guest); });

  // --- Envío ---
  function payload() {
    const yes = answer === "yes";
    return {
      invitacion: guest.nombre, lugares: guest.lugares,
      asistencia: yes ? "Sí asistirá" : "No asistirá",
      asistentes: yes ? count : 0,
      comentarios: $("rsvp-comments").value.trim()
    };
  }
  const asText = p => `Confirmación de asistencia\nInvitación: ${p.invitacion}\nRespuesta: ${p.asistencia}\nPersonas: ${p.asistentes} de ${p.lugares}\nComentarios: ${p.comentarios || "-"}`;

  function finish() {
    const yes = answer === "yes";
    $("rsvp-done-title").textContent = yes ? "¡Gracias por confirmar!" : "Gracias por avisarnos";
    $("rsvp-done-text").textContent = yes
      ? `Anotamos tu asistencia${count > 1 ? " (" + count + " personas)" : ""}. ¡Nos vemos el 24 de abril!`
      : "Lamentamos que no puedas acompañarnos. Te llevamos en el corazón.";
    show("done");
  }

  sendBtn.addEventListener("click", async () => {
    if (!guest || !answer) return;
    const p = payload(); sendBtn.disabled = true; status.textContent = "Enviando…";
    try {
      if (CONFIG.rsvpEndpoint) {
        // text/plain evita el "preflight" CORS, que Google Apps Script no soporta
        const r = await fetch(CONFIG.rsvpEndpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(p) });
        if (!r.ok) throw new Error("http " + r.status);
        const j = await r.json().catch(() => ({ ok: true }));
        if (j.ok === false) throw new Error(j.error || "error");
      } else if (CONFIG.rsvpWhatsapp) {
        window.open(`https://wa.me/${CONFIG.rsvpWhatsapp}?text=${encodeURIComponent(asText(p))}`, "_blank", "noopener");
      } else if (CONFIG.rsvpEmail) {
        location.href = `mailto:${CONFIG.rsvpEmail}?subject=${encodeURIComponent("RSVP boda Yaneli y Ernesto")}&body=${encodeURIComponent(asText(p))}`;
      } else {
        status.textContent = "Falta configurar el destino de las confirmaciones en main.js."; sendBtn.disabled = false; return;
      }
      finish();
    } catch (err) {
      status.textContent = "No pudimos enviar tu respuesta. Inténtalo de nuevo, por favor."; sendBtn.disabled = false;
    }
  });
})();
