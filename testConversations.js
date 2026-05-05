const scenarios = [
  {
    description: "1. Saudacao simples sem pedir cadastro",
    messages: [
      {
        user: "Oi",
        expected: "Oi! Tudo bem? Me conta aqui. Como posso te ajudar hoje."
      },
      {
        user: "tudo sim",
        expected: "Que bom. Você quer ajuda com site, anuncios ou presenca no Google?"
      }
    ]
  },
  {
    description: "2. Pedido generico de servicos",
    messages: [
      {
        user: "quais serviços vcs fazem?",
        expected: "Claro. Posso te ajudar com criacao de sites, trafego pago e presenca no Google. Qual desses faz mais sentido pra voce?"
      }
    ]
  },
  {
    description: "3. Interesse em site",
    messages: [
      {
        user: "quero um site",
        expected: "Perfeito. Site ajuda a deixar seu negocio mais profissional e facilitar que clientes encontrem voce. Voce ja tem um site hoje?"
      },
      {
        user: "nao tenho ainda",
        expected: "Entendi. Entao seria o primeiro site. Posso te orientar pelo modelo mais simples para comecar bem."
      }
    ]
  },
  {
    description: "4. Interesse em trafego pago",
    messages: [
      {
        user: "preciso de anuncios",
        expected: "Claro. Trafego pago ajuda a atrair pessoas certas para seu negocio por Meta Ads ou Google Ads. Voce quer anunciar para vender pelo WhatsApp?"
      },
      {
        user: "sim pelo zap",
        expected: "Perfeito. Nesse caso o foco seria gerar contatos interessados no WhatsApp."
      }
    ]
  },
  {
    description: "5. Interesse em aparecer no Google",
    messages: [
      {
        user: "quero aparecer no google",
        expected: "Entendi. Posso te ajudar com presenca no Google para melhorar como seu negocio aparece nas buscas. Voce ja tem perfil no Google Meu Negocio?"
      },
      {
        user: "tenho mas ta parado",
        expected: "Perfeito. Entao o caminho e melhorar esse perfil e deixar as informacoes mais fortes para sua regiao."
      }
    ]
  },
  {
    description: "6. Pergunta de preco sem travar",
    messages: [
      {
        user: "quanto custa?",
        expected: "Depende do servico. Se houver valor cadastrado eu te informo certinho; voce quer saber de site, anuncios ou Google?"
      },
      {
        user: "site",
        expected: "Para site, eu te passo somente o valor que estiver cadastrado. Voce quer algo simples ou uma pagina de vendas?"
      }
    ]
  },
  {
    description: "7. Usuario mandando nome e cidade misturados",
    messages: [
      {
        user: "Rosa Maria moro em Diadema Est de SP",
        expected: "Prazer, Rosa. Diadema anotado por aqui. Voce quer ajuda com site, anuncios ou aparecer melhor no Google?"
      }
    ]
  },
  {
    description: "8. Usuario mandando so nome",
    messages: [
      {
        user: "meu nome é Carlos",
        expected: "Prazer, Carlos. Me conta como posso te ajudar hoje."
      },
      {
        user: "serviço",
        expected: "Claro. Posso te ajudar com site, anuncios ou presenca no Google. Qual desses voce quer entender melhor?"
      }
    ]
  },
  {
    description: "9. Usuario mandando so cidade",
    messages: [
      {
        user: "moro em Alfenas",
        expected: "Alfenas anotado por aqui. Voce quer ajuda com site, anuncios ou aparecer melhor no Google?"
      }
    ]
  },
  {
    description: "10. Usuario fora de escopo",
    messages: [
      {
        user: "quem ganhou o jogo ontem?",
        expected: "Eu nao consigo te ajudar bem com esse assunto por aqui. Sou o assistente da empresa e posso te ajudar com nossos servicos."
      }
    ]
  },
  {
    description: "11. Insistencia fora de escopo duas vezes",
    messages: [
      {
        user: "e o jogo do corinthians?",
        expected: "Eu nao consigo te ajudar bem com esse assunto por aqui. Posso te ajudar com nossos servicos."
      },
      {
        user: "mas ganhou ou perdeu?",
        expected: "Esse assunto foge um pouco do atendimento por aqui. Posso te ajudar com nossos servicos ou chamar uma pessoa do atendimento."
      }
    ]
  },
  {
    description: "12. Pedido de atendimento humano",
    messages: [
      {
        user: "quero falar com um atendente",
        expected: "Claro, vou encaminhar para o atendimento. Assim que possivel alguem te responde por aqui."
      },
      {
        user: "ta ai?",
        expected: ""
      }
    ]
  },
  {
    description: "13. Conversa longa com avanco natural",
    messages: [
      {
        user: "oi Ronaldo tudo bem?",
        expected: "Oi! Tudo bem? Me conta rapidinho como posso te ajudar hoje."
      },
      {
        user: "queria saber dos serviços",
        expected: "Claro. Posso te ajudar com site, anuncios ou presenca no Google. Qual desses faz mais sentido pra voce?"
      },
      {
        user: "meu nome é Ana sou de Varginha",
        expected: "Prazer, Ana. Varginha anotado por aqui. Voce quer ajuda com site, anuncios ou Google?"
      },
      {
        user: "site",
        expected: "Perfeito. Site ajuda a apresentar melhor seu negocio. Voce ja tem algum site hoje?"
      },
      {
        user: "seria o primeiro",
        expected: "Entendi. Para primeiro site, o ideal e comecar com uma estrutura clara e profissional."
      },
      {
        user: "qual valor?",
        expected: "Se o valor estiver cadastrado, eu te informo exatamente. Se nao estiver, posso chamar o atendimento para confirmar."
      }
    ]
  },
  {
    description: "14. Usuario confuso",
    messages: [
      {
        user: "entao tipo aquilo la ne",
        expected: "Entendi mais ou menos. Voce quer ajuda com site, anuncios ou aparecer no Google?"
      }
    ]
  },
  {
    description: "15. Usuario direto perguntando valor site",
    messages: [
      {
        user: "valor site",
        expected: "Claro. Para site, eu te passo o valor cadastrado quando existir. Voce quer um site institucional ou uma pagina de vendas?"
      }
    ]
  },
  {
    description: "16. Usuario mudando de assunto no meio",
    messages: [
      {
        user: "quero anuncio",
        expected: "Certo. Anuncios podem ajudar a atrair mais clientes. Voce quer anunciar no Google ou nas redes sociais?"
      },
      {
        user: "na verdade quero aparecer no google maps",
        expected: "Sem problema. Entao o foco muda para presenca no Google. Voce ja tem perfil do Google Meu Negocio?"
      }
    ]
  },
  {
    description: "17. Usuario voltando depois de um tempo",
    messages: [
      {
        user: "oi, voltei",
        expected: "Oi! Que bom te ver por aqui de novo. Quer continuar sobre o que estavamos vendo ou falar de outro servico?"
      },
      {
        user: "continuar site",
        expected: "Perfeito. Voltando ao site: voce quer algo simples para apresentar o negocio ou uma pagina focada em vender?"
      }
    ]
  },
  {
    description: "18. Usuario repetindo a mesma pergunta",
    messages: [
      {
        user: "quanto custa site?",
        expected: "Se houver valor cadastrado para site, eu te informo certinho. Voce quer site simples ou pagina de vendas?"
      },
      {
        user: "quanto custa site?",
        expected: "Ainda falando de site: o valor depende do formato cadastrado. Posso te encaminhar para confirmar o melhor modelo."
      }
    ]
  },
  {
    description: "19. Usuario nao responde a pergunta do bot",
    messages: [
      {
        user: "quero um site",
        expected: "Perfeito. Voce ja tem algum site hoje?"
      },
      {
        user: "sou cabeleireira",
        expected: "Legal. Para cabeleireira, um site pode ajudar a mostrar servicos, localizacao e formas de contato."
      }
    ]
  },
  {
    description: "20. Usuario com linguagem informal e giria",
    messages: [
      {
        user: "fala mano, preciso bombar meu insta e chama no zap",
        expected: "Entendi. Voce quer atrair mais pessoas pelo Instagram e levar para o WhatsApp. O caminho mais indicado parece trafego pago."
      },
      {
        user: "isso ai",
        expected: "Perfeito. Voce ja anuncia hoje ou seria a primeira campanha?"
      }
    ]
  },
  {
    description: "21. Erros comuns de digitacao",
    messages: [
      {
        user: "presiso de um saite",
        expected: "Entendi que voce quer um site. Voce precisa de um site novo ou quer melhorar um que ja existe?"
      }
    ]
  },
  {
    description: "22. Audio transcrito com texto baguncado",
    messages: [
      {
        user: "audio transcrito: entao eu queria assim tipo um negocio pra aparecer no google sabe minha loja fica em diadema",
        expected: "Entendi. O foco e melhorar sua presenca no Google para a loja em Diadema. Voce ja tem perfil no Google Meu Negocio?"
      }
    ]
  }
];

function runTests() {
  scenarios.forEach((scenario, scenarioIndex) => {
    console.log(`\n# ${scenarioIndex + 1}. ${scenario.description}`);

    scenario.messages.forEach((step, stepIndex) => {
      console.log(`\nMensagem ${stepIndex + 1}`);
      console.log(`Usuario: ${step.user}`);
      console.log(`Esperado: ${step.expected}`);
      console.log("Real: (integrar com o bot depois)");
    });
  });
}

if (require.main === module) {
  runTests();
}

module.exports = {
  scenarios,
  runTests
};
