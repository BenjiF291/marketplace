/* Existing rig metadata; presentation only. */
export const manifest={
  "fox": {
    "module": "./fox-3d-model.js",
    "factory": "createFox",
    "asset": "./assets/companions/fox-meshy-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.15,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "fox:travel",
      "attack": "fox:basic",
      "cast": "fox:feint",
      "hit": "fox:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle",
      "walk",
      "run"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.8658667148212542,
        0,
        -1.9439603039122697
      ],
      "max": [
        0.874326229095459,
        2.5999999046325684,
        1.8927088975906372
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 0.95,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "fox:basic",
      "fox:feint",
      "fox:rally",
      "fox:travel",
      "fox:hit"
    ]
  },
  "snail": {
    "module": "./snail-3d-model.js",
    "factory": "createSnail",
    "asset": "./assets/companions/snail-meshy-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 0.85,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "snail:travel",
      "attack": "snail:basic",
      "cast": "snail:guard",
      "hit": "snail:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle",
      "crawl",
      "fast_crawl"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.8684855828953619,
        0,
        -1.9349675538943618
      ],
      "max": [
        0.8684855440710315,
        2.5999999046325684,
        1.9389755333017547
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 0.32,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "snail:basic",
      "snail:guard",
      "snail:taunt",
      "snail:travel",
      "snail:hit"
    ]
  },
  "dragon": {
    "module": "./dragon-3d-model.js",
    "factory": "createDragon",
    "asset": "./assets/companions/dragon-meshy-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.6,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "dragon:travel",
      "attack": "dragon:basic",
      "cast": "dragon:embers",
      "hit": "dragon:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle",
      "walk",
      "run",
      "fly"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.3041521310806274,
        0,
        -1.7828458547592163
      ],
      "max": [
        1.3028802000370487,
        2.6001823727215707,
        1.7828458547592163
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "dragon:basic",
      "dragon:embers",
      "dragon:sweep",
      "dragon:travel",
      "dragon:hit"
    ]
  },
  "rill": {
    "module": "./rill-3d-model.js",
    "factory": "createRill",
    "asset": "./assets/creatures/aeri-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.85,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "rill:travel",
      "attack": "rill:basic",
      "cast": "rill:gust",
      "hit": "rill:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.9858277128028523,
        0,
        -1.2384743207258846
      ],
      "max": [
        0.9868078002288794,
        2.601702306341021,
        1.230534553527832
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "rill:basic",
      "rill:gust",
      "rill:slipstream",
      "rill:travel",
      "rill:hit"
    ]
  },
  "rill-species": {
    "module": "./rill-species-3d-model.js",
    "factory": "createRillSpecies",
    "asset": "./assets/creatures/rill-species-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.85,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "rill-species:travel",
      "attack": "rill-species:basic",
      "cast": "rill-species:double",
      "hit": "rill-species:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.026887838129852,
        0,
        -1.2760891245182546
      ],
      "max": [
        1.026800151294413,
        2.6006203120411713,
        1.2781919240951538
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "rill-species:basic",
      "rill-species:double",
      "rill-species:lift",
      "rill-species:travel",
      "rill-species:hit"
    ]
  },
  "brugar": {
    "module": "./brugar-3d-model.js?v=tailblend3",
    "factory": "createBrugar",
    "asset": "./assets/creatures/brakk-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.7,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "brugar:travel",
      "attack": "brugar:basic",
      "cast": "brugar:brace",
      "hit": "brugar:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.9586149349618327,
        0,
        -1.6067843393202033
      ],
      "max": [
        1.9567718505859375,
        2.001830490096327,
        1.6061532497406006
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 0.7,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.34,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "brugar:basic",
      "brugar:brace",
      "brugar:challenge",
      "brugar:travel",
      "brugar:hit"
    ]
  },
  "brugar-species": {
    "module": "./brugar-species-3d-model.js?v=tailblend3",
    "factory": "createBrugarSpecies",
    "asset": "./assets/creatures/brugar-species-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.7,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "brugar-species:travel",
      "attack": "brugar-species:basic",
      "cast": "brugar-species:bulwark",
      "hit": "brugar-species:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -2.0795670216676667,
        0,
        -1.525708794593811
      ],
      "max": [
        2.0744382716882726,
        2.0026323504666954,
        1.525708794593811
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 0.7,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.34,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "brugar-species:basic",
      "brugar-species:bulwark",
      "brugar-species:crush",
      "brugar-species:travel",
      "brugar-species:hit"
    ]
  },
  "krynn": {
    "module": "./krynn-3d-model.js",
    "factory": "createKrynn",
    "asset": "./assets/creatures/virex-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.5,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "krynn:travel",
      "attack": "krynn:basic",
      "cast": "krynn:snare",
      "hit": "krynn:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -2.0658237724392112,
        0,
        -1.7687819443787465
      ],
      "max": [
        2.0615459102852896,
        2,
        1.7656790182523336
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "krynn:basic",
      "krynn:snare",
      "krynn:expose",
      "krynn:travel",
      "krynn:hit"
    ]
  },
  "krynn-species": {
    "module": "./krynn-species-3d-model.js",
    "factory": "createKrynnSpecies",
    "asset": "./assets/creatures/krynn-species-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.5,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "krynn-species:travel",
      "attack": "krynn-species:basic",
      "cast": "krynn-species:shred",
      "hit": "krynn-species:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -2.00498885656636,
        0,
        -1.7385016511255218
      ],
      "max": [
        2.001608312082041,
        2.0000000074505806,
        1.7340699297007225
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "krynn-species:basic",
      "krynn-species:shred",
      "krynn-species:silence",
      "krynn-species:travel",
      "krynn-species:hit"
    ]
  },
  "fenra": {
    "module": "./fenra-3d-model.js",
    "factory": "createFenra",
    "asset": "./assets/creatures/saelis-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.8,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "fenra:travel",
      "attack": "fenra:basic",
      "cast": "fenra:restore",
      "hit": "fenra:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.3700064186925636,
        0,
        -1.0090981357591506
      ],
      "max": [
        1.36919415672494,
        2.6002517363189868,
        1.0090409517288208
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "fenra:basic",
      "fenra:restore",
      "fenra:clarity",
      "fenra:travel",
      "fenra:hit"
    ]
  },
  "fenra-species": {
    "module": "./fenra-species-3d-model.js",
    "factory": "createFenraSpecies",
    "asset": "./assets/creatures/fenra-species-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.8,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "fenra-species:travel",
      "attack": "fenra-species:basic",
      "cast": "fenra-species:mend",
      "hit": "fenra-species:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.395953613640259,
        0,
        -1.0031576019592008
      ],
      "max": [
        1.3930748210036121,
        2.6003360269309583,
        1.003707572290482
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "fenra-species:basic",
      "fenra-species:mend",
      "fenra-species:pulse",
      "fenra-species:travel",
      "fenra-species:hit"
    ]
  },
  "veyrin": {
    "module": "./veyrin-3d-model.js",
    "factory": "createVeyrin",
    "asset": "./assets/creatures/kael-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.9,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "veyrin:travel",
      "attack": "veyrin:basic",
      "cast": "veyrin:pounce",
      "hit": "veyrin:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.7031686404853872,
        0,
        -1.8499886986140492
      ],
      "max": [
        1.6986157849819288,
        2.200000047683716,
        1.8489328378223184
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "veyrin:basic",
      "veyrin:pounce",
      "veyrin:roar",
      "veyrin:travel",
      "veyrin:hit"
    ]
  },
  "tharos": {
    "module": "./tharos-3d-model.js",
    "factory": "createTharos",
    "asset": "./assets/creatures/tharos-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 2.05,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "tharos:travel",
      "attack": "tharos:basic",
      "cast": "tharos:rush",
      "hit": "tharos:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.5577474750728304,
        -0.0009207567090535884,
        -1.8619003491536525
      ],
      "max": [
        1.552211939136364,
        2.200000047683716,
        1.8590857935300884
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "tharos:basic",
      "tharos:rush",
      "tharos:sweep",
      "tharos:travel",
      "tharos:hit"
    ]
  },
  "talren": {
    "module": "./talren-3d-model.js",
    "factory": "createTalren",
    "asset": "./assets/creatures/talren-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.75,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "talren:travel",
      "attack": "talren:basic",
      "cast": "talren:charge",
      "hit": "talren:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.7983246263818321,
        0,
        -1.8203633050079955
      ],
      "max": [
        0.8005602359771729,
        2.200000047683716,
        1.8160146474838257
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "talren:basic",
      "talren:charge",
      "talren:break",
      "talren:travel",
      "talren:hit"
    ]
  },
  "northern-talren": {
    "module": "./northern-talren-3d-model.js",
    "factory": "createNorthernTalren",
    "asset": "./assets/creatures/northern-talren-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.8,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "northern-talren:travel",
      "attack": "northern-talren:basic",
      "cast": "northern-talren:guard",
      "hit": "northern-talren:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.6925507394239521,
        0,
        -1.9085105717579598
      ],
      "max": [
        0.6925507187843323,
        2.200000047683716,
        1.905819296836853
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "northern-talren:basic",
      "northern-talren:guard",
      "northern-talren:stand",
      "northern-talren:travel",
      "northern-talren:hit"
    ]
  },
  "defender-talren": {
    "module": "./defender-talren-3d-model.js",
    "factory": "createDefenderTalren",
    "asset": "./assets/creatures/defender-talren-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.85,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "defender-talren:travel",
      "attack": "defender-talren:basic",
      "cast": "defender-talren:wall",
      "hit": "defender-talren:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -0.7264395356178284,
        0,
        -1.8575092675066163
      ],
      "max": [
        0.7264395356178284,
        2.200000047683716,
        1.8553543090820312
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 0.7,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "defender-talren:basic",
      "defender-talren:wall",
      "defender-talren:check",
      "defender-talren:travel",
      "defender-talren:hit"
    ]
  },
  "defender-rill": {
    "module": "./defender-rill-3d-model.js",
    "factory": "createDefenderRill",
    "asset": "./assets/creatures/defender-rill-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.9,
    "footAnchor": "visible bounds bottom, centered X/Z",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "defender-rill:travel",
      "attack": "defender-rill:basic",
      "cast": "defender-rill:screen",
      "hit": "defender-rill:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.005155425317975,
        0,
        -1.3211911748792509
      ],
      "max": [
        1.0056271417261684,
        2.600988142287371,
        1.3165453672409058
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.24,
    "portraitScale": 1.35,
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "defender-rill:basic",
      "defender-rill:screen",
      "defender-rill:dive",
      "defender-rill:travel",
      "defender-rill:hit"
    ]
  },
  "kanji": {
    "module": "./kanji-3d-model.js?v=kanji1",
    "factory": "createKanji",
    "asset": "./assets/creatures/kanji-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.9,
    "footAnchor": "Supplied paw stance; visible bounds bottom",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "kanji:travel",
      "attack": "kanji:basic",
      "cast": "kanji:feather-rush",
      "hit": "kanji:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.3597267866134644,
        0,
        -2.159972667694092
      ],
      "max": [
        2.354252815246582,
        2.200000047683716,
        2.1074793338775635
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.29,
    "portraitScale": 1.35,
    "sourceOrientation": "Source mesh +X/+Z; geometry and rig normalized -0.60 radians to face +Z",
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "kanji:basic",
      "kanji:feather-rush",
      "kanji:wing-guard",
      "kanji:travel",
      "kanji:hit"
    ]
  },
  "trusk": {
    "module": "./trusk-3d-model.js?v=trusk1",
    "factory": "createTrusk",
    "asset": "./assets/creatures/trusk-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 2.0,
    "footAnchor": "Supplied paw stance; visible bounds bottom",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "trusk:travel",
      "attack": "trusk:basic",
      "cast": "trusk:scale-guard",
      "hit": "trusk:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.525891900062561,
        0,
        -1.9510494470596313
      ],
      "max": [
        1.5349760055541992,
        2.200000047683716,
        2.280517816543579
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.27,
    "portraitScale": 1.35,
    "sourceOrientation": "Supplied diagonal +X/+Z mesh normalized -0.75 radians to face +Z",
    "combatAnimationModule": "./creature-brawl-attacks.js?v=travel2",
    "combatClips": [
      "trusk:basic",
      "trusk:scale-guard",
      "trusk:armoured-rush",
      "trusk:travel",
      "trusk:hit"
    ]
  },
  "velkris": {
    "module": "./velkris-3d-model.js?v=velkris1",
    "factory": "createVelkris",
    "asset": "./assets/creatures/velkris-source.glb",
    "forwardAxis": "+Z",
    "yawOffset": 0,
    "height": 1.55,
    "footAnchor": "Supplied paw stance; visible bounds bottom",
    "headAnchor": [
      0,
      0.95,
      0
    ],
    "attackOrigin": [
      0,
      0.65,
      0.3
    ],
    "clipMap": {
      "idle": "idle",
      "travel": "velkris:travel",
      "attack": "velkris:basic",
      "cast": "velkris:carapace-guard",
      "hit": "velkris:hit",
      "defeat": null,
      "victory": null
    },
    "availableClips": [
      "idle"
    ],
    "rootMotion": "Skeletal clips remain in-place; parent approach/return uses distance-driven limb cycles and target facing.",
    "playbackSpeed": 1,
    "contentBounds": {
      "min": [
        -1.9517959356307983,
        0,
        -2.1818623542785645
      ],
      "max": [
        1.9517959356307983,
        1.7999999523162842,
        2.1818623542785645
      ]
    },
    "attackSocket": "Head_joint",
    "movementDistance": 1.05,
    "impactPolicy": "Skeletal clip contact at 54% precedes authoritative result events; Twin Talons advances to its second contact at 73%.",
    "proceduralFallbacks": [
      "defeat fade",
      "victory ring"
    ],
    "portraitWidth": 0.3,
    "portraitScale": 1.35,
    "sourceOrientation": "Supplied mesh faces +Z; no yaw normalization required",
    "combatAnimationModule": "./creature-brawl-attacks.js?v=velkris1",
    "combatClips": [
      "velkris:basic",
      "velkris:tail-strike",
      "velkris:carapace-guard",
      "velkris:travel",
      "velkris:hit"
    ]
  }
};
