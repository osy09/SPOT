function sanitizeSong(song) {
  return song;
}

function sanitizeSongs(songs) {
  if (!Array.isArray(songs)) {
    return [];
  }
  return songs;
}

module.exports = {
  sanitizeSong,
  sanitizeSongs,
};
