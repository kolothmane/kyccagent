const fs = require('fs');

const content = fs.readFileSync('app/api/check/route.ts', 'utf8');

const updated = content.replace(
  /const previousFollowers: string\[\] = await redis\.smembers\(PREVIOUS_KEY\);[\s\S]*?await redis\.sadd\(PREVIOUS_KEY, currentFollowers\[0\], \.\.\.currentFollowers\.slice\(1\)\);\n    }/,
  `const CURRENT_KEY = \`followers:\${targetUsername}:current\`;

    // Store current followers in Redis to use SDIFF
    if (currentFollowers.length > 0) {
      await redis.sadd(CURRENT_KEY, currentFollowers[0], ...currentFollowers.slice(1));
    }

    // If previous list doesn't exist, we assume it's the first run, no lost/new
    const previousExists = await redis.exists(PREVIOUS_KEY);
    
    let newFollowers: string[] = [];
    let lostFollowers: string[] = [];
    
    if (previousExists) {
      // SDIFF current previous -> new followers
      newFollowers = await redis.sdiff(CURRENT_KEY, PREVIOUS_KEY);
      // SDIFF previous current -> lost followers
      lostFollowers = await redis.sdiff(PREVIOUS_KEY, CURRENT_KEY);
    }

    if (newFollowers.length > 0 || lostFollowers.length > 0) {
      const newList = newFollowers.length > 0 ? newFollowers.join(', ') : '—';
      const lostList = lostFollowers.length > 0 ? lostFollowers.join(', ') : '—';
      const message =
        \`⚠️ Changement détecté sur \${targetUsername}\\n\` +
        \`✅ Nouveau(x) : \${newList}\\n\` +
        \`❌ Départ(s) : \${lostList}\`;
      await sendTelegramMessage(message);
    }

    // Update previous with current
    await redis.del(PREVIOUS_KEY);
    if (currentFollowers.length > 0) {
      await redis.rename(CURRENT_KEY, PREVIOUS_KEY);
    }`
);

fs.writeFileSync('app/api/check/route.ts', updated);
