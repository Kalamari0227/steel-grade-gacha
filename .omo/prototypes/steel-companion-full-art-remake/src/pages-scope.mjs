if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration()
    .then(registration => registration?.update())
    .catch(error => console.warn('페이지 캐시 갱신을 확인하지 못했습니다.', error.name));
}
