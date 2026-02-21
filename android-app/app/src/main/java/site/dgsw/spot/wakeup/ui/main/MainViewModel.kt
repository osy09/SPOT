package site.dgsw.spot.wakeup.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import site.dgsw.spot.wakeup.data.local.datastore.SettingsDataStore
import site.dgsw.spot.wakeup.data.repository.SongRepository
import site.dgsw.spot.wakeup.domain.model.Song
import site.dgsw.spot.wakeup.scheduler.AlarmScheduler
import javax.inject.Inject

data class MainUiState(
    val songs: List<Song> = emptyList(),
    val playTimes: List<String> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val lastRefreshedTime: String? = null,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val repository: SongRepository,
    private val settingsDataStore: SettingsDataStore,
    private val alarmScheduler: AlarmScheduler,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState(isLoading = true))
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                repository.songs,
                settingsDataStore.playTimesFlow,
            ) { songs, times -> songs to times }
                .collect { (songs, times) ->
                    _uiState.update {
                        it.copy(songs = songs, playTimes = times, isLoading = false)
                    }
                }
        }
        // 앱 시작 시 최초 갱신
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val songs = repository.refreshSongs()
                val times = settingsDataStore.playTimesFlow.first()
                alarmScheduler.scheduleAll(times, songs)
                val now = java.util.Calendar.getInstance()
                val h = now.get(java.util.Calendar.HOUR_OF_DAY).toString().padStart(2, '0')
                val m = now.get(java.util.Calendar.MINUTE).toString().padStart(2, '0')
                _uiState.update { it.copy(isLoading = false, lastRefreshedTime = "$h:$m") }
            } catch (e: Exception) {
                // 갱신 실패 시 캐시된 기상송으로 알람 재등록
                try {
                    val cached = repository.getCachedSongs()
                    val times = settingsDataStore.playTimesFlow.first()
                    alarmScheduler.scheduleAll(times, cached)
                } catch (_: Exception) { /* 캐시도 없으면 알람 등록 불가 */ }
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = "갱신 실패: ${e.message}")
                }
            }
        }
    }
}
