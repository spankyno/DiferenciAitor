(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('diferenciaitor:theme') || 'null');
    var dark = stored ? stored !== 'light' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
