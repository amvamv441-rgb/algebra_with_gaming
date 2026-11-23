/* =========================================================
   حسابان ۱ — content registry
   ========================================================= */
(function () {
  'use strict';
  const AWG = (window.AWG = window.AWG || {});
  AWG.LESSONS = [];
  AWG.addLesson = function (lesson) {
    if (!lesson || !lesson.id) return;
    const i = AWG.LESSONS.findIndex((l) => l.id === lesson.id);
    if (i >= 0) AWG.LESSONS[i] = lesson;
    else AWG.LESSONS.push(lesson);
  };
  AWG.lessonById = function (id) {
    return AWG.LESSONS.find((l) => String(l.id) === String(id)) || null;
  };
  AWG.lessonIndex = function (id) {
    return AWG.LESSONS.findIndex((l) => String(l.id) === String(id));
  };
  AWG.lessonNav = function (id) {
    const i = AWG.lessonIndex(id);
    return {
      prev: i > 0 ? AWG.LESSONS[i - 1] : null,
      next: i >= 0 && i < AWG.LESSONS.length - 1 ? AWG.LESSONS[i + 1] : null
    };
  };
})();
