// Shared HireED context loader for student identity
(function () {
  const params = new URLSearchParams(window.location.search);
  const urlStudentId = params.get('studentId');
  const urlStudentName = params.get('studentName');

  if (urlStudentId) localStorage.setItem('studentId', urlStudentId);
  if (urlStudentName) localStorage.setItem('studentName', urlStudentName);

  const studentId = localStorage.getItem('studentId');
  const studentName = localStorage.getItem('studentName');
  if (!studentId && !studentName) return;

  const linkParams = new URLSearchParams();
  if (studentId) linkParams.set('studentId', studentId);
  if (studentName) linkParams.set('studentName', studentName);

  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
    const [path] = href.split('?');
    link.setAttribute('href', `${path}?${linkParams.toString()}`);
  });
})();
