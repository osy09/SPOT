const prisma = require('../src/lib/prisma');

async function main() {
  // 환경 변수에서 초기 관리자 이메일 가져오기
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;

  if (!adminEmail) {
    console.log('[Seed] INITIAL_ADMIN_EMAIL이 설정되지 않아 LEADER 생성을 건너뜁니다');
    console.log('[Seed] 초기 LEADER를 생성하려면 INITIAL_ADMIN_EMAIL 환경 변수를 설정하세요');
    return;
  }

  // 이메일 형식 검증
  if (!adminEmail.endsWith('@dgsw.hs.kr')) {
    console.error('[Seed] INITIAL_ADMIN_EMAIL은 @dgsw.hs.kr 이메일 주소여야 합니다');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        role: 'LEADER',
        is_blacklisted: false,
      },
    });
    console.log(`[Seed] LEADER 사용자 생성 완료: ${adminEmail}`);
  } else {
    // 기존 사용자가 아직 LEADER가 아닌 경우 LEADER로 업데이트
    if (existingUser.role !== 'LEADER') {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'LEADER' },
      });
      console.log(`[Seed] ${adminEmail}을(를) LEADER로 변경했습니다`);
    } else {
      console.log(`[Seed] ${adminEmail}은(는) 이미 LEADER입니다`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
