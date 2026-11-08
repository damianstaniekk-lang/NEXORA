let csrfToken = "";
let currentUser = null;
let notes = [];
let editingId = null;
let authMode = "login";
let currentView = "notes";
let toastTimer;

const $ = (id) => document.getElementById(id);
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (csrfToken && ["POST","PATCH","DELETE","PUT"].includes((options.method || "GET").toUpperCase())) headers["x-csrf-token"] = csrfToken;
  const response = await fetch(url, { credentials: "same-origin", ...options, headers });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Etwas ist schiefgelaufen.");
  return data;
}
function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function setTheme() {
  document.body.classList.toggle("light");
  localStorage.setItem("nexora-theme", document.body.classList.contains("light") ? "light" : "dark");
}
function applySavedTheme() { if (localStorage.getItem("nexora-theme") === "light") document.body.classList.add("light"); }
$("themeAuth").onclick = setTheme; $("themeApp").onclick = setTheme;

function setAuthMode(mode) {
  authMode = mode;
  const register = mode === "register";
  $("authTitle").textContent = register ? "Dein Space wartet." : "Schön, dass du da bist.";
  $("authSub").textContent = register ? "Erstelle dein Konto und starte deinen eigenen Workspace." : "Melde dich an und mach weiter, wo du aufgehört hast.";
  $("authSubmit").innerHTML = register ? 'Konto erstellen <span>→</span>' : 'Einloggen <span>→</span>';
  $("switchText").textContent = register ? "Du hast schon ein Konto?" : "Noch kein Konto?";
  $("switchMode").textContent = register ? "Jetzt einloggen" : "Jetzt registrieren";
  $("password").autocomplete = register ? "new-password" : "current-password";
  $("password").minLength = register ? 12 : 1;
  $("authError").textContent = "";
}
$("switchMode").onclick = () => setAuthMode(authMode === "login" ? "register" : "login");
$("authForm").onsubmit = async (e) => {
  e.preventDefault(); $("authError").textContent = "";
  try {
    const data = await api(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify({ username: $("username").value, password: $("password").value }) });
    currentUser = data.user; csrfToken = data.csrfToken || csrfToken; await afterLogin();
  } catch (err) { $("authError").textContent = err.message; }
};
async function afterLogin() {
  $("authView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("profileName").textContent = currentUser.username; $("avatar").textContent = currentUser.username[0].toUpperCase();
  $("profileRole").textContent = currentUser.role === "admin" ? "Administrator" : "Mitglied";
  $("adminNav").classList.toggle("hidden", currentUser.role !== "admin");
  await loadNotes(); showNotes();
}
async function loadNotes() {
  const data = await api("/api/notes"); notes = data.notes; $("noteCount").textContent = notes.length; renderNotes();
}
function renderNotes() {
  const query = $("searchInput").value.toLowerCase();
  const filtered = notes.filter(n => (n.title + " " + n.body).toLowerCase().includes(query));
  $("notesGrid").innerHTML = "";
  filtered.forEach(note => {
    const card = document.createElement("button"); card.className = "note-card";
    const title = document.createElement("h3"); title.textContent = note.title || "Ohne Titel";
    const body = document.createElement("p"); body.textContent = note.body || "Noch kein Inhalt...";
    const time = document.createElement("time"); time.textContent = new Date(note.updatedAt.replace(" ", "T") + "Z").toLocaleString("de-DE", { dateStyle:"medium", timeStyle:"short" });
    card.append(title, body, time); card.onclick = () => openEditor(note); $("notesGrid").append(card);
  });
  $("emptyState").classList.toggle("hidden", filtered.length > 0 || notes.length > 0);
  if (notes.length === 0) $("emptyState").classList.remove("hidden");
}
$("searchInput").oninput = renderNotes;
function showNotes() {
  currentView = "notes"; $("notesSection").classList.remove("hidden"); $("editorSection").classList.add("hidden"); $("adminSection").classList.add("hidden");
  $("sectionEyebrow").textContent = "DEIN WORKSPACE"; $("pageTitle").textContent = "Deine Notizen";
  $("allNotesBtn").classList.add("active"); $("adminNav").classList.remove("active");
}
function openEditor(note = null) {
  currentView = "editor"; editingId = note ? note.id : null;
  $("notesSection").classList.add("hidden"); $("editorSection").classList.remove("hidden"); $("adminSection").classList.add("hidden");
  $("noteTitle").value = note?.title || ""; $("noteBody").value = note?.body || "";
  $("deleteNote").classList.toggle("hidden", !note); $("saveStatus").textContent = note ? "Gespeicherte Notiz" : "Neue Notiz";
  $("sectionEyebrow").textContent = "NOTIZ EDITOR"; $("pageTitle").textContent = note ? "Notiz bearbeiten" : "Neue Notiz";
  $("allNotesBtn").classList.remove("active"); $("noteTitle").focus();
}
function newNote() { openEditor(); }
$("newNoteTop").onclick = $("newNoteSide").onclick = $("emptyCreate").onclick = newNote;
$("backNotes").onclick = () => { showNotes(); };
$("allNotesBtn").onclick = async () => { showNotes(); await loadNotes(); };
$("saveNote").onclick = async () => {
  const payload = { title: $("noteTitle").value, body: $("noteBody").value };
  try {
    if (editingId) await api(`/api/notes/${editingId}`, { method:"PATCH", body:JSON.stringify(payload) });
    else { const result = await api("/api/notes", { method:"POST", body:JSON.stringify(payload) }); editingId = result.note.id; }
    await loadNotes(); $("deleteNote").classList.remove("hidden"); $("saveStatus").textContent = "Gespeichert"; toast("Notiz gespeichert ✓");
  } catch (err) { toast(err.message); }
};
$("deleteNote").onclick = async () => {
  if (!editingId || !confirm("Diese Notiz wirklich löschen?")) return;
  try { await api(`/api/notes/${editingId}`, { method:"DELETE" }); await loadNotes(); showNotes(); toast("Notiz gelöscht."); }
  catch (err) { toast(err.message); }
};
$("logoutBtn").onclick = async () => {
  try { await api("/api/auth/logout", { method:"POST", body:"{}" }); }
  catch (e) {}
  currentUser = null; location.reload();
};

async function showAdmin() {
  currentView = "admin"; $("notesSection").classList.add("hidden"); $("editorSection").classList.add("hidden"); $("adminSection").classList.remove("hidden");
  $("sectionEyebrow").textContent = "CONTROL CENTER"; $("pageTitle").textContent = "Admin-Bereich";
  $("allNotesBtn").classList.remove("active"); $("adminNav").classList.add("active");
  $("adminNotes").classList.add("hidden");
  try {
    const { users } = await api("/api/admin/users"); $("userTotal").textContent = users.length;
    $("usersTable").innerHTML = "";
    users.forEach(user => {
      const tr = document.createElement("tr");
      const name = document.createElement("td"); name.textContent = user.username;
      const role = document.createElement("td"); role.innerHTML = `<span class="role-tag">${user.role === "admin" ? "★ Admin" : "Mitglied"}</span>`;
      const count = document.createElement("td"); count.textContent = user.noteCount;
      const status = document.createElement("td"); const badge = document.createElement("span"); badge.className = "status" + (user.banned ? " banned" : ""); badge.textContent = user.banned ? "Gesperrt" : "Aktiv"; status.append(badge);
      const actions = document.createElement("td"); actions.className = "table-actions";
      const view = document.createElement("button"); view.className = "mini-btn"; view.textContent = "Notizen ansehen"; view.onclick = () => viewUserNotes(user.id);
      actions.append(view);
      if (user.id !== currentUser.id) {
        const toggle = document.createElement("button"); toggle.className = "mini-btn"; toggle.textContent = user.banned ? "Entsperren" : "Sperren";
        toggle.onclick = () => changeUser(user.id, user.banned ? "unban" : "ban"); actions.append(toggle);
        const roleBtn = document.createElement("button"); roleBtn.className = "mini-btn"; roleBtn.textContent = user.role === "admin" ? "Admin entfernen" : "Zum Admin";
        roleBtn.onclick = () => changeUser(user.id, user.role === "admin" ? "demote" : "promote"); actions.append(roleBtn);
        const del = document.createElement("button"); del.className = "mini-btn"; del.textContent = "Löschen"; del.onclick = () => deleteUser(user.id, user.username); actions.append(del);
      }
      tr.append(name,role,count,status,actions); $("usersTable").append(tr);
    });
  } catch (err) { toast(err.message); }
}
$("adminNav").onclick = showAdmin;
async function changeUser(id, action) {
  const label = {ban:"Nutzer sperren?",unban:"Nutzer entsperren?",promote:"Zum Admin ernennen?",demote:"Admin-Rechte entfernen?"}[action];
  if (!confirm(label)) return;
  try { await api(`/api/admin/users/${id}`, {method:"PATCH",body:JSON.stringify({action})}); toast("Änderung gespeichert."); await showAdmin(); }
  catch (err) { toast(err.message); }
}
async function deleteUser(id, username) {
  if (!confirm(`Konto von ${username} und alle zugehörigen Notizen löschen?`)) return;
  try { await api(`/api/admin/users/${id}`, {method:"DELETE"}); toast("Konto gelöscht."); await showAdmin(); }
  catch (err) { toast(err.message); }
}
async function viewUserNotes(id) {
  try {
    const data = await api(`/api/admin/users/${id}/notes`);
    $("adminNotesTitle").textContent = `Notizen von ${data.user.username}`;
    $("adminNoteList").innerHTML = "";
    $("adminNotesList").innerHTML = "";
    if (!data.notes.length) $("adminNotesList").textContent = "Dieser Nutzer hat noch keine Notizen.";
    data.notes.forEach(n => {
      const card = document.createElement("article"); card.className = "admin-note";
      const h = document.createElement("h4"); h.textContent = n.title || "Ohne Titel";
      const p = document.createElement("p"); p.textContent = n.body || "Kein Inhalt";
      const time = document.createElement("small"); time.className = "subtle"; time.textContent = n.updatedAt;
      card.append(h,p,time); $("adminNotesList").append(card);
    });
    $("adminNotes").classList.remove("hidden");
    $("adminNotes").scrollIntoView({behavior:"smooth",block:"start"});
  } catch (err) { toast(err.message); }
}
$("closeAdminNotes").onclick = () => $("adminNotes").classList.add("hidden");

async function init() {
  applySavedTheme();
  try {
    const config = await api("/api/config"); csrfToken = config.csrfToken;
    const data = await api("/api/me"); currentUser = data.user; await afterLogin();
  } catch (e) { setAuthMode("login"); }
}
init();
