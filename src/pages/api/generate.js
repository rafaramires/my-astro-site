// generate.js
let users = {};

function generateHash(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=UTF-8"
};

export async function post({ request }) {
  try {
    const { action, email, planQuantity, prompt } = await request.json();

    if (!email && action !== "generatePlan") {
      throw new Error("E-mail é obrigatório");
    }

    const emailHash = email ? generateHash(email) : null;

    if (action === "createPayment") {
      const planPrices = {
        1: 4.90,
        10: 19.90,
        30: 29.90,
        50: 49.90
      };
      const amount = planPrices[planQuantity] || 4.90;

      const paymentData = {
        items: [{
          title: `Plano de ${planQuantity} geração(ões)`,
          unit_price: amount,
          quantity: 1,
          currency_id: "BRL"
        }],
        payer: { email },
        back_urls: {
          success: `http://localhost:3000/success.html?email=${encodeURIComponent(email)}`, // Corrigido
          failure: "http://localhost:3000/failure",
          pending: "http://localhost:3000/pending"
        },
        auto_return: "approved"
      };

      console.log("Token Mercado Pago:", import.meta.env.MERCADO_PAGO_ACCESS_TOKEN);

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.MERCADO_PAGO_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paymentData)
      });

      const mpText = await mpResponse.text();
      console.log("Resposta do Mercado Pago:", mpText);

      if (!mpResponse.ok) {
        throw new Error(mpText || "Erro ao criar pagamento");
      }

      const mpData = JSON.parse(mpText);
      return new Response(JSON.stringify({ init_point: mpData.init_point }), {
        headers: corsHeaders
      });
    }

    if (action === "confirmPayment") {
      users[emailHash] = users[emailHash] || { plansLeft: 0 };
      users[emailHash].plansLeft += planQuantity;
      return new Response(JSON.stringify({ success: true, plansLeft: users[emailHash].plansLeft }), {
        headers: corsHeaders
      });
    }

    if (action === "generatePlan") {
      const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gemma2-9b-it",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024
        })
      });
    
      if (!apiRes.ok) {
        const errText = await apiRes.text();
        throw new Error(errText || "Erro na API da Groq");
      }
    
      const { choices } = await apiRes.json();
      const generatedText = choices[0].message.content;
    
      return new Response(generatedText, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain"
        }
      });
    }
    

    // if (action === "generatePlan") {
    //   // if (!prompt) throw new Error("Prompt é obrigatório para gerar o plano");

    //   // if (!users[emailHash] || users[emailHash].plansLeft <= 0) {
    //   //   throw new Error("Você não tem planos disponíveis. Compre um plano!");
    //   // }

    //   const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    //     method: "POST",
    //     headers: {
    //       "Authorization": `Bearer ${import.meta.env.GROQ_API_KEY}`,
    //       "Content-Type": "application/json"
    //     },
    //     body: JSON.stringify({
    //       model: "gemma2-9b-it",
    //       messages: [{ role: "user", content: prompt }],
    //       temperature: 0.7,
    //       max_tokens: 1024
    //     })
    //   });

    //   const text = await response.text();
    //   console.log("Resposta da Groq:", text);

    //   if (!response.ok) {
    //     throw new Error(text || "Erro na API da Groq");
    //   }

    //   const data = JSON.parse(text);
    //   //users[emailHash].plansLeft -= 1;

    //   return new Response(JSON.stringify({ content: data.choices[0].message.content, plansLeft: users[emailHash].plansLeft }), {
    //     headers: corsHeaders
    //   });
    // }

    throw new Error("Ação inválida");
  } catch (erro) {
    console.error("Erro no backend:", erro.message);
    return new Response(JSON.stringify({ error: erro.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}