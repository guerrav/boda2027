// Pega este código en Apps Script (ver pasos en LEEME.txt). Cada invitación ocupa una sola fila:
// si alguien vuelve a confirmar, se actualiza su fila en lugar de duplicarla.
const HOJA = "Confirmaciones";
const COLUMNAS = ["Fecha", "Invitación", "Lugares", "Respuesta", "Asistentes", "Comentarios"];
const HOJA_INV = "Invitados";   // pestaña con la lista: Invitación | Lugares | Incluye (opcional)

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(HOJA);
    if (!sh) {
      sh = ss.insertSheet(HOJA);
      sh.appendRow(COLUMNAS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
    }
    const fila = [new Date(), d.invitacion, d.lugares, d.asistencia, d.asistentes, d.comentarios || ""];
    const nombres = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
    const i = nombres.indexOf(d.invitacion);
    if (i >= 0 && sh.getLastRow() > 1) sh.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
    else sh.appendRow(fila);
    return salida({ ok: true });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Consulta: ...exec?nombre=<invitación>  -> devuelve solo la respuesta previa de esa invitación (si existe)
function doGet(e) {
  // ...exec?lista=1  -> devuelve la lista de invitados (pestaña "Invitados") para el buscador del sitio
  if (e && e.parameter && e.parameter.lista) {
    const ish = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_INV);
    if (!ish || ish.getLastRow() < 2) return salida({ ok: true, invitados: [] });
    const lista = ish.getRange(2, 1, ish.getLastRow() - 1, 3).getValues()
      .filter(r => String(r[0]).trim() && Number(r[1]) >= 1)
      .map(r => ({ nombre: String(r[0]).trim(), lugares: Number(r[1]), incluye: String(r[2] || "").trim() }));
    return salida({ ok: true, invitados: lista });
  }
  const nombre = e && e.parameter && e.parameter.nombre;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
  if (!nombre || !sh || sh.getLastRow() < 2) return salida({ ok: true, found: false });
  const filas = sh.getRange(2, 1, sh.getLastRow() - 1, COLUMNAS.length).getValues();
  const f = filas.find(r => r[1] === nombre);
  if (!f) return salida({ ok: true, found: false });
  return salida({ ok: true, found: true, fecha: new Date(f[0]).toISOString(), respuesta: f[3], asistentes: f[4], comentarios: f[5] });
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecútala UNA sola vez (menú Ejecutar > cargarInvitadosIniciales) para crear la pestaña "Invitados" con la lista de prueba.
// Si la pestaña ya tiene datos, no hace nada (no borra lo que hayas editado).
function cargarInvitadosIniciales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_INV);
  if (sh && sh.getLastRow() > 1) return;
  if (!sh) sh = ss.insertSheet(HOJA_INV);
  const filas = [["Margarita", 1, ""], ["Emilio", 1, ""], ["Geovas", 1, ""], ["Cori", 1, ""], ["Brandon", 2, "Brandon y acompañante"], ["Mami", 1, ""], ["Mariana", 1, ""], ["Dario", 1, ""], ["Georgina", 1, ""], ["Mario", 1, ""], ["Marcelina", 1, ""], ["Alberto", 1, ""], ["Yazmin", 3, "Yazmin y 2 acompañantes"], ["Lupita", 2, "Lupita y acompañante"], ["Beatriz", 1, ""], ["Oliver", 2, "Oliver y acompañante"], ["Yadira", 2, "Yadira y acompañante"], ["Nidia", 1, ""], ["Charly", 1, ""], ["Tía Mari", 1, ""], ["Paola", 1, ""], ["Miguel", 1, ""], ["Angelica", 1, ""], ["Fernando", 1, ""], ["Elsy", 2, "Elsy y acompañante"], ["Albert", 2, "Albert y acompañante"], ["Padrino Roberto", 1, ""], ["Madrina Rosita", 1, ""], ["Tía Tere", 1, ""], ["Tía Lucero", 1, ""], ["Tío Mario", 1, ""], ["Tía Laura", 1, ""], ["Lourdes", 1, ""], ["Patricia", 1, ""], ["Oscar", 1, ""], ["Leti", 1, ""], ["Alicia", 1, ""], ["Arturo", 1, ""], ["Leti (2)", 1, ""], ["Paolo", 1, ""], ["Fabrizio", 1, ""], ["Frida", 1, ""], ["Maricarmen", 1, ""], ["Mario Alberto", 1, ""], ["Ana", 1, ""], ["Naye", 1, ""], ["LuisRa", 1, ""], ["Deya", 1, ""], ["Josue", 1, ""], ["Xochitl", 1, ""], ["Hector", 1, ""], ["Michelle", 1, ""], ["Evelyn", 1, ""], ["Joseluis", 1, ""], ["LuisAngel", 1, ""], ["Kali", 1, ""], ["Monchis", 1, ""], ["Monica", 1, ""], ["Donovan", 1, ""], ["Ian", 1, ""], ["Quetzali", 1, ""], ["Ana (2)", 1, ""], ["Ale Lopez", 1, ""], ["Rene", 1, ""], ["Mia", 2, "Mia y acompañante"], ["Itza", 1, ""], ["Mike", 1, ""], ["Yael", 1, ""], ["Tony", 2, "Tony y acompañante"], ["Greer", 1, ""], ["Sebas", 1, ""], ["Alecita", 1, ""], ["Rosalba", 1, ""], ["Sahyli", 1, ""], ["Roman", 1, ""], ["Brenda Paola", 1, ""], ["Valeria", 1, ""], ["Tona", 2, "Tona y acompañante"], ["Otto", 1, ""], ["Diana", 1, ""], ["Arturo (2)", 1, ""], ["Michelle (2)", 1, ""], ["Jannike", 1, ""], ["Jannike 2", 1, ""], ["Steph", 1, ""], ["Edmundo", 1, ""], ["Iranzu", 1, ""], ["Merijn", 1, ""], ["Jaime", 1, ""], ["Marta", 1, ""], ["Andrea", 1, ""], ["Pietro", 1, ""], ["Andrea (2)", 1, ""], ["Maria", 1, ""], ["Carlos Ubaldo", 1, ""], ["Sol", 1, ""]];
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([["Invitación", "Lugares", "Incluye (opcional)"]]).setFontWeight("bold");
  sh.getRange(2, 1, filas.length, 3).setValues(filas);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 220); sh.setColumnWidth(3, 260);
}
