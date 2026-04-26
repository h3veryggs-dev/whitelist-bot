const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

// 🔑 CONFIG
const TOKEN = process.env.TOKEN;

const CATEGORIA_TICKET = "1496029624088662049";
const CARGO_APROVADO = "1496029516370415658";
const CARGO_STAFF = "1496029476231053363";
const CANAL_TRANSCRIPT = "1496155923457118459";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const perguntas = [
  "Qual seu nome real?",
  "Qual sua idade real?",
  "Já jogou RP antes?",
  "Conte sua história:",
  "Você leu as regras?"
];

async function enviarTranscript(channel) {
  try {
    const canalLogs = channel.guild.channels.cache.get(CANAL_TRANSCRIPT);

    if (!canalLogs) {
      console.log("Canal de transcript não encontrado.");
      return;
    }

    const mensagens = await channel.messages.fetch({ limit: 100 });

    const transcript = mensagens
      .reverse()
      .map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || "[sem texto]"}`)
      .join("\n");

    const buffer = Buffer.from(transcript || "Sem mensagens.", "utf-8");

    await canalLogs.send({
      content: `📄 Transcript do ticket: **${channel.name}**`,
      files: [
        {
          attachment: buffer,
          name: `${channel.name}-transcript.txt`
        }
      ]
    });

  } catch (err) {
    console.error("Erro ao enviar transcript:", err);
  }
}

function fecharTicket(channel, tempo = 5000) {
  setTimeout(async () => {
    try {
      await enviarTranscript(channel);

      console.log("Fechando ticket:", channel.name);
      await channel.delete("Ticket finalizado");
    } catch (err) {
      console.error("Erro ao fechar ticket:", err);
    }
  }, tempo);
}

// Quando abrir ticket
client.on("channelCreate", async (channel) => {
  if (!channel.isTextBased()) return;

  // Só cria botão em ticket de whitelist
  if (!channel.name.toLowerCase().includes("whitelist")) return;

  try {
    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("iniciar")
        .setLabel("📋 Iniciar Whitelist")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: "Clique para iniciar sua whitelist.",
      components: [btn]
    });

  } catch (err) {
    console.error("Erro ao enviar botão:", err);
  }
});

// Botões
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;

  if (interaction.customId === "iniciar") {
    await interaction.reply("Iniciando...");

    let respostas = [];
    let etapa = 0;

    await channel.send(perguntas[0]);

    const collector = channel.createMessageCollector({
      filter: m => m.author.id === interaction.user.id,
      time: 300000
    });

    collector.on("collect", async (msg) => {
      respostas.push(msg.content);
      etapa++;

      if (etapa < perguntas.length) {
        await channel.send(perguntas[etapa]);
      } else {
        collector.stop("finalizado");
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "finalizado") {
        await channel.send("⏰ Tempo esgotado. Ticket será fechado.").catch(() => {});
        fecharTicket(channel);
        return;
      }

      try {
        const idade = parseInt(respostas[1]);
        const historia = respostas[3] || "";
        const historiaLower = historia.toLowerCase();
        const regras = respostas[4]?.toLowerCase() || "";

        if (!idade || idade < 14) {
          await channel.send("❌ Reprovado: idade inválida.");
          fecharTicket(channel);
          return;
        }

        if (
          historia.length < 50 ||
          historiaLower.includes("não quero") ||
          historiaLower.includes("nao quero") ||
          historiaLower === "não" ||
          historiaLower === "nao"
        ) {
          await channel.send("❌ Reprovado: história fraca ou inválida.");
          fecharTicket(channel);
          return;
        }

        if (!regras.includes("sim")) {
          await channel.send("❌ Reprovado: não confirmou que leu as regras.");
          fecharTicket(channel);
          return;
        }

        const staffBtns = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("aprovar")
            .setLabel("✅ Aprovar")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("reprovar")
            .setLabel("❌ Reprovar")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send(`⏳ ${interaction.user}, aguarde um STAFF analisar suas respostas.`);

        await channel.send({
          content: "📋 Painel da Staff:",
          components: [staffBtns]
        });

      } catch (err) {
        console.error("Erro geral:", err);
        await channel.send("⚠️ Ocorreu um erro. Ticket será fechado.").catch(() => {});
        fecharTicket(channel);
      }
    });
  }

  if (interaction.customId === "aprovar") {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });
    }

    await interaction.reply("✅ Aprovado! Ticket será fechado.");

    const membro = channel.guild.members.cache.get(channel.topic);

    if (membro) {
      await membro.roles.add(CARGO_APROVADO).catch(console.error);
    }

    fecharTicket(channel);
  }

  if (interaction.customId === "reprovar") {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });
    }

    await interaction.reply("❌ Reprovado! Ticket será fechado.");
    fecharTicket(channel);
  }
});

client.on("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(TOKEN);