import { PrismaClient, Sport, BetType, GameStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding EVHunter database...");

  const books = [
    { slug: "draftkings", name: "DraftKings", isSharp: false },
    { slug: "fanduel", name: "FanDuel", isSharp: false },
    { slug: "betmgm", name: "BetMGM", isSharp: false },
    { slug: "caesars", name: "Caesars", isSharp: false },
    { slug: "pinnacle", name: "Pinnacle", isSharp: true },
  ];

  for (const b of books) {
    await prisma.sportsbook.upsert({
      where: { slug: b.slug },
      create: b,
      update: { name: b.name, isSharp: b.isSharp },
    });
  }

  const dal = await prisma.team.upsert({
    where: { externalId: "nba-dal" },
    create: {
      externalId: "nba-dal",
      sport: Sport.NBA,
      name: "Mavericks",
      abbreviation: "DAL",
      city: "Dallas",
    },
    update: {},
  });

  const phx = await prisma.team.upsert({
    where: { externalId: "nba-phx" },
    create: {
      externalId: "nba-phx",
      sport: Sport.NBA,
      name: "Suns",
      abbreviation: "PHX",
      city: "Phoenix",
    },
    update: {},
  });

  const game = await prisma.game.upsert({
    where: { externalId: "game-dal-phx" },
    create: {
      externalId: "game-dal-phx",
      sport: Sport.NBA,
      homeTeamId: phx.id,
      awayTeamId: dal.id,
      scheduledAt: new Date(Date.now() + 86400000),
      status: GameStatus.SCHEDULED,
      venue: "Footprint Center",
    },
    update: {},
  });

  const luka = await prisma.player.upsert({
    where: { externalId: "player-luka" },
    create: {
      externalId: "player-luka",
      sport: Sport.NBA,
      teamId: dal.id,
      name: "Luka Dončić",
      position: "PG",
    },
    update: {},
  });

  const prop = await prisma.propMarket.upsert({
    where: {
      gameId_marketKey_playerId: {
        gameId: game.id,
        marketKey: "points_o_32_5",
        playerId: luka.id,
      },
    },
    create: {
      gameId: game.id,
      playerId: luka.id,
      betType: BetType.PLAYER_PROP,
      marketKey: "points_o_32_5",
      line: 32.5,
      description: "Luka Dončić Points O 32.5",
    },
    update: {},
  });

  const pinnacle = await prisma.sportsbook.findUniqueOrThrow({
    where: { slug: "pinnacle" },
  });

  await prisma.modelPrediction.create({
    data: {
      propMarketId: prop.id,
      gameId: game.id,
      playerId: luka.id,
      modelKey: "rolling-average",
      trueProbability: 0.562,
      fairAmericanOdds: -128,
      confidence: 0.78,
      featuresJson: { roll5: 33.2, projection: 34.1 },
    },
  });

  await prisma.oddsLine.create({
    data: {
      propMarketId: prop.id,
      sportsbookId: pinnacle.id,
      betType: BetType.PLAYER_PROP,
      americanOdds: -105,
      decimalOdds: 1.952,
      impliedProb: 0.512,
      line: 32.5,
    },
  });

  await prisma.evOpportunity.create({
    data: {
      propMarketId: prop.id,
      gameId: game.id,
      sportsbookId: pinnacle.id,
      betType: BetType.PLAYER_PROP,
      americanOdds: -105,
      impliedProbability: 0.512,
      modelProbability: 0.562,
      fairOdds: -128,
      evPercent: 5.82,
      kellyFraction: 0.061,
      confidence: 0.78,
      hitRate: 0.58,
      clv: 0.021,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
