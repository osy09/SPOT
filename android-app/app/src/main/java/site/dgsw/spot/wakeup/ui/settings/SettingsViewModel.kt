package site.dgsw.spot.wakeup.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import site.dgsw.spot.wakeup.data.local.datastore.SettingsDataStore
import site.dgsw.spot.wakeup.data.repository.SongRepository
import site.dgsw.spot.wakeup.scheduler.AlarmScheduler
import javax.inject.Inject

data class SettingsUiState(
    val playTimes: List<String> = emptyList(),
    val isSaving: Boolean = false,
    val savedMessage: String? = null,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsDataStore: SettingsDataStore,
    private val repository: SongRepository,
    private val alarmScheduler: AlarmScheduler,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            settingsDataStore.playTimesFlow.collect { times ->
                _uiState.update { it.copy(playTimes = times) }
            }
        }
    }

    fun savePlayTimes(times: List<String>) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, savedMessage = null) }
            settingsDataStore.savePlayTimes(times)
            // DataStore가 정제(중복 제거·정렬·최대 5개)한 실제 저장값으로 알람 등록
            val cleanedTimes = settingsDataStore.playTimesFlow.first()
            val songs = repository.getCachedSongs()
            alarmScheduler.scheduleAll(cleanedTimes, songs)
            _uiState.update { it.copy(isSaving = false, savedMessage = "저장되었습니다. 알람이 재등록되었습니다.") }
        }
    }
}
