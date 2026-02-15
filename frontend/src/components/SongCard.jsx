export default function SongCard({ song, showUser, actions, showDate = true }) {
  return (
    <div className="cu-card flex flex-col sm:flex-row gap-3 sm:gap-4">
      <img
        src={`https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`}
        alt={song.title}
        className="w-full h-28 sm:w-32 sm:h-20 rounded-lg object-cover flex-shrink-0 border"
        style={{ borderColor: 'var(--cu-line)' }}
      />
      <div className="flex-1 min-w-0">
        <a
          href={song.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline line-clamp-2 sm:line-clamp-1"
        >
          {song.title}
        </a>
        <p className="text-xs mt-0.5" style={{ color: 'var(--cu-muted)' }}>{song.channel_name}</p>
        {showUser && song.user && (
          <p className="text-xs mt-1" style={{ color: 'var(--cu-muted)' }}>{song.user.name}</p>
        )}
        {showDate && song.play_date && (
          <p className="text-xs mt-1" style={{ color: 'var(--cu-accent)' }}>
            {new Date(song.play_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        )}
      </div>
      {actions && (
        <div className="w-full sm:w-auto flex items-center justify-end sm:justify-start gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
