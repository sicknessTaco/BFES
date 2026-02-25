export const catalog = {
  games: [
    {
      id: "iron-horizon",
      title: "Iron Horizon",
      genre: "Action RPG",
      description: "Open world sci-fi RPG with co-op raids.",
      price: 29.99,
      stripePriceId: "price_game_iron_horizon"
    },
    {
      id: "neon-rush-2088",
      title: "Neon Rush 2088",
      genre: "Racing",
      description: "Arcade racing with online seasons and clans.",
      price: 24.99,
      stripePriceId: "price_game_neon_rush"
    },
    {
      id: "echo-protocol",
      title: "Echo Protocol",
      genre: "Narrative",
      description: "Story-driven thriller with branching endings.",
      price: 34.99,
      stripePriceId: "price_game_echo_protocol"
    }
  ],
  memberships: [
    {
      id: "bf-golden",
      name: "BF Golden",
      interval: "mes",
      price: 7.99,
      stripePriceId: "price_pass_bf_golden",
      tier: "Base",
      highlight: "Equivalente a EA Play",
      perks: [
        "Acceso al catalogo base",
        "Pruebas anticipadas de nuevos builds",
        "10% de descuento en compras"
      ]
    },
    {
      id: "bf-nocturna",
      name: "BF: Nocturna",
      interval: "mes",
      price: 14.99,
      stripePriceId: "price_pass_bf_nocturna",
      tier: "Pro",
      highlight: "Version pro estilo EA Play Pro",
      perks: [
        "Todo lo de BF Golden",
        "Lanzamientos dia 1",
        "Contenido adicional exclusivo",
        "Prioridad en servidores y eventos"
      ]
    }
  ]
};
