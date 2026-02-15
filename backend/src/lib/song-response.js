function sanitizeSong(song) {
  if (!song || typeof song !== 'object') {
    return song;
  }

  const { story, is_anonymous, ...rest } = song;
  return rest;
}

function sanitizeSongs(songs) {
  if (!Array.isArray(songs)) {
    return [];
  }

  return songs.map(sanitizeSong);
}

module.exports = {
  sanitizeSong,
  sanitizeSongs,
};
