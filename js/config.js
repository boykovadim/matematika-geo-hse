/* Настройки сайта. Сюда вставить ссылку на сайт создателя. */
window.SITE = {
  name: 'Наглядно',
  course: { faculty: 'ФГГТ НИУ ВШЭ', teacher: 'Кийков Сергей Ортабаевич' },
  creator: {
    name: 'Бойко Вадим',
    about: 'Сделал этот сайт для своей группы. Разрабатываю сайты и лендинги на заказ.',
    url: '', /* например: 'https://example.com' */
    urlLabel: 'Мои сайты и лендинги',
  },
};

/* Реестр лекций: каждый файл из папки lectures вызывает Lectures.add({...}) */
window.Lectures = {
  all: [],
  add(l) {
    this.all.push(l);
    this.all.sort((a, b) => a.date.localeCompare(b.date));
    this.all.forEach((x, i) => (x.n = i + 1));
  },
  get(id) { return this.all.find((l) => l.id === id); },
};
