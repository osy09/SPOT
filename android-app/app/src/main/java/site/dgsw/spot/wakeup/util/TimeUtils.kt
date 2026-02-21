package site.dgsw.spot.wakeup.util

import java.util.Calendar

object TimeUtils {
    /**
     * "HH:mm" → 오늘 날짜 기준 epoch ms.
     * 이미 지난 시각이면 내일로 설정.
     */
    fun todayMillisFor(timeStr: String): Long {
        val (hour, minute) = timeStr.split(":").map { it.toInt() }
        return Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }.timeInMillis
    }
}
