const form = document.getElementById('form');
const input = document.getElementById('url');
const error = document.getElementById('error');
window.nexoraDesktop.getConfig().then(c => { if (c.serverUrl) input.value = c.serverUrl; });
form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = '';
  try { await window.nexoraDesktop.saveServer(input.value); }
  catch (e) { error.textContent = e.message || 'Verbindung fehlgeschlagen.'; }
});
