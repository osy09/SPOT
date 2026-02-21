package site.dgsw.spot.wakeup.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import site.dgsw.spot.wakeup.R
import site.dgsw.spot.wakeup.domain.model.Song
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val ADMIN_PASSWORD = "1234"
private const val ADMIN_TAP_COUNT = 10
private const val TAP_RESET_MS = 3_000L  // 마지막 탭 이후 3초 경과 시 카운터 초기화

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onNavigateToSettings: () -> Unit,
    onAdminExit: () -> Unit,
    isBroadcastPlaying: Boolean,
    onPlayBroadcast: (Int) -> Unit,
    onStopBroadcast: () -> Unit,
    viewModel: MainViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    // 관리자 종료: 제목 10회 연속 탭
    var adminTapCount by remember { mutableIntStateOf(0) }
    var lastTapTime by remember { mutableLongStateOf(0L) }
    var showAdminDialog by remember { mutableStateOf(false) }
    var showManualBroadcastDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "대구소프트웨어마이스터고등학교 기숙사 방송시스템 (SPOT연동)",
                        modifier = Modifier.clickable(
                            indication = null,
                            interactionSource = remember { MutableInteractionSource() },
                        ) {
                            val now = System.currentTimeMillis()
                            if (now - lastTapTime > TAP_RESET_MS) adminTapCount = 0
                            adminTapCount++
                            lastTapTime = now
                            if (adminTapCount >= ADMIN_TAP_COUNT) {
                                adminTapCount = 0
                                showAdminDialog = true
                            }
                        },
                    )
                },
                actions = {
                    uiState.lastRefreshedTime?.let {
                        Text(
                            "갱신: $it",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(end = 4.dp),
                        )
                    }
                    IconButton(onClick = { viewModel.refresh() }, enabled = !uiState.isLoading) {
                        Icon(Icons.Default.Refresh, contentDescription = "수동 갱신")
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "설정")
                    }
                },
            )
        },
        bottomBar = {
            BottomStatusBar(
                isBroadcastPlaying = isBroadcastPlaying,
                onManualBroadcast = { showManualBroadcastDialog = true },
                onStopBroadcast = onStopBroadcast,
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
        ) {
            if (uiState.isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
            }

            uiState.errorMessage?.let {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        it,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            ScheduleSummaryCard(
                playTimes = uiState.playTimes,
                songs = uiState.songs,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                "오늘의 기상송 (${uiState.songs.size}곡)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (uiState.songs.isEmpty() && !uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "오늘 예정된 기상송이 없습니다.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(uiState.songs) { index, song ->
                        SongListItem(song = song, index = index + 1)
                    }
                }
            }
        }
    }

    if (showAdminDialog) {
        AdminExitDialog(
            onDismiss = { showAdminDialog = false },
            onExit = onAdminExit,
        )
    }

    if (showManualBroadcastDialog) {
        ManualBroadcastDialog(
            onDismiss = { showManualBroadcastDialog = false },
            onPlay = { resId -> onPlayBroadcast(resId) },
        )
    }
}

// -------------------------------------------------------------------------
// 하단 상태 바 (시각 + 수동방송 버튼)
// -------------------------------------------------------------------------

@Composable
private fun BottomStatusBar(
    isBroadcastPlaying: Boolean,
    onManualBroadcast: () -> Unit,
    onStopBroadcast: () -> Unit,
) {
    var currentTime by remember { mutableStateOf("") }
    var blinkOn by remember { mutableStateOf(true) }

    // 시각 업데이트: 1초마다 갱신
    LaunchedEffect(Unit) {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        while (true) {
            currentTime = fmt.format(Date())
            delay(1000L)
        }
    }

    // 깜빡임: 재생 중일 때 1초 간격으로 녹색 ↔ 빨간색 토글
    LaunchedEffect(isBroadcastPlaying) {
        if (isBroadcastPlaying) {
            while (true) {
                blinkOn = !blinkOn
                delay(1000L)
            }
        } else {
            blinkOn = true
        }
    }

    val buttonColor = when {
        isBroadcastPlaying && blinkOn  -> Color(0xFF2E7D32) // 녹색 ON
        isBroadcastPlaying && !blinkOn -> Color(0xFFD32F2F) // 빨간색 OFF
        else                           -> Color(0xFFD32F2F) // 기본 빨간색
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .background(Color.Black),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = currentTime,
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = 24.dp),
        )
        Button(
            onClick = if (isBroadcastPlaying) onStopBroadcast else onManualBroadcast,
            modifier = Modifier.fillMaxHeight(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = buttonColor,
                contentColor = Color.White,
            ),
            contentPadding = PaddingValues(horizontal = 32.dp),
            elevation = ButtonDefaults.buttonElevation(0.dp),
        ) {
            Text("수동방송", fontWeight = FontWeight.Bold, fontSize = 20.sp)
        }
    }
}

// -------------------------------------------------------------------------
// 수동방송 다이얼로그 (음원 선택 + MediaPlayer 재생)
// -------------------------------------------------------------------------

private data class BroadcastSound(val label: String, val resId: Int)

@Composable
private fun ManualBroadcastDialog(onDismiss: () -> Unit, onPlay: (Int) -> Unit) {
    val sounds = listOf(
        BroadcastSound("예비기상송", R.raw.spare_alarm),
        BroadcastSound("점호시작",   R.raw.roll_call_start),
        BroadcastSound("점호종료",   R.raw.roll_call_end),
    )

    AlertDialog(
        onDismissRequest = { /* 뒤로가기·외부 클릭으로 닫히지 않도록 차단 */ },
        title = { Text("수동방송 선택") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                sounds.forEach { sound ->
                    OutlinedButton(
                        onClick = { onPlay(sound.resId); onDismiss() },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(sound.label, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        },
    )
}

// -------------------------------------------------------------------------
// 관리자 종료 다이얼로그
// -------------------------------------------------------------------------

@Composable
private fun AdminExitDialog(onDismiss: () -> Unit, onExit: () -> Unit) {
    var password by remember { mutableStateOf("") }
    var showError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("관리자 확인") },
        text = {
            Column {
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; showError = false },
                    label = { Text("관리자 비밀번호") },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    isError = showError,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (showError) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "비밀번호가 올바르지 않습니다.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (password == ADMIN_PASSWORD) onExit()
                else showError = true
            }) { Text("확인") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("취소") }
        },
    )
}

// -------------------------------------------------------------------------
// 재생 스케줄 카드
// -------------------------------------------------------------------------

@Composable
private fun ScheduleSummaryCard(playTimes: List<String>, songs: List<Song>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("재생 스케줄", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            if (playTimes.isEmpty()) {
                Text("설정된 재생 시간이 없습니다.", style = MaterialTheme.typography.bodySmall)
            } else {
                playTimes.forEachIndexed { index, time ->
                    val songLabel = when {
                        songs.isEmpty() -> "(기상송 없음)"
                        index < songs.size -> songs[index].title
                        else -> "${songs.last().title} (반복)"
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            time,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                        )
                        Text(
                            songLabel,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f).padding(start = 16.dp),
                        )
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------------------
// 기상송 목록 아이템
// -------------------------------------------------------------------------

@Composable
private fun SongListItem(song: Song, index: Int) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        "$index",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(song.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text(
                    "${song.channelName}  •  신청: ${song.requesterName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
