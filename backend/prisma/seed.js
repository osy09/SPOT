const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get initial admin email from environment variable
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;

  if (!adminEmail) {
    console.log('[Seed] INITIAL_ADMIN_EMAIL not set, skipping LEADER creation');
    console.log('[Seed] To create an initial LEADER, set INITIAL_ADMIN_EMAIL environment variable');
    return;
  }

  // Validate email format
  if (!adminEmail.endsWith('@dgsw.hs.kr')) {
    console.error('[Seed] INITIAL_ADMIN_EMAIL must be a @dgsw.hs.kr email address');
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
    console.log(`[Seed] Created LEADER user: ${adminEmail}`);
  } else {
    // Update existing user to LEADER if not already
    if (existingUser.role !== 'LEADER') {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'LEADER' },
      });
      console.log(`[Seed] Updated ${adminEmail} to LEADER role`);
    } else {
      console.log(`[Seed] ${adminEmail} is already a LEADER`);
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
