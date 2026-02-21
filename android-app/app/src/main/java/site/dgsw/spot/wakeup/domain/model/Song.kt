package site.dgsw.spot.wakeup.domain.model

data class Song(
    val id: Long,
    val videoId: String,
    val youtubeUrl: String,
    val title: String,
    val channelName: String,
    val requesterName: String,
)
