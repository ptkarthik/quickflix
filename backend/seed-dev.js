const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.movieProject.create({
    data: {
      title: 'Coolie',
      rating: 4.5,
      genre: 'Action',
      language: 'Tamil',
      releaseYear: 2026,
      oneLiner: 'A high-octane action thriller.',
      review: 'An absolute blast from start to finish.',
      status: 'READY'
    }
  });
  console.log('Project seeded:', project.title);
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
