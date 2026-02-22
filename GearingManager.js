export const GEARING_DATABASE = {
    "Suzuki": [
        {
            model: "GSX 1300R Hayabusa (99-07)",
            primary: 1.596,
            sprocket: 17,
            chainring: 40,
            gears: [2.615, 1.937, 1.526, 1.285, 1.136, 1.043],
            tyre: 1960
        },
        {
            model: "GSX-R 750 (11-18)",
            primary: 1.761,
            sprocket: 17,
            chainring: 45,
            gears: [2.785, 2.052, 1.714, 1.500, 1.347, 1.208],
            tyre: 1960
        },
        {
            model: "GSX-R 600 (11-18)",
            primary: 1.974,
            sprocket: 16,
            chainring: 43,
            gears: [2.687, 2.105, 1.761, 1.521, 1.347, 1.230],
            tyre: 1960
        },
        {
            model: "GSX-R 1000 (K5/K6)",
            primary: 1.552,
            sprocket: 17,
            chainring: 42,
            gears: [2.562, 2.052, 1.714, 1.500, 1.360, 1.269],
            tyre: 1960
        }
    ],
    "Honda": [
        {
            model: "CBR 1000RR (04-05)",
            primary: 1.604,
            sprocket: 16,
            chainring: 40,
            gears: [2.538, 1.941, 1.578, 1.380, 1.250, 1.166],
            tyre: 1960
        },
        {
            model: "CBR 600RR (07-12)",
            primary: 2.111,
            sprocket: 16,
            chainring: 42,
            gears: [2.750, 2.000, 1.666, 1.444, 1.304, 1.208],
            tyre: 1960
        }
    ],
    "Yamaha": [
        {
            model: "YZF R1 (04-06)",
            primary: 1.512,
            sprocket: 17,
            chainring: 45,
            gears: [2.500, 1.842, 1.500, 1.333, 1.200, 1.115],
            tyre: 1960
        },
        {
            model: "YZF R6 (06-16)",
            primary: 2.073,
            sprocket: 16,
            chainring: 45,
            gears: [2.583, 2.000, 1.667, 1.444, 1.286, 1.150],
            tyre: 1960
        },
        {
            model: "MT-07 (HO)",
            primary: 1.925,
            sprocket: 16,
            chainring: 43,
            gears: [2.846, 2.125, 1.632, 1.300, 1.091, 0.964],
            tyre: 1960
        }
    ],
    "Kawasaki": [
        {
            model: "ZX-10R (04-05)",
            primary: 1.611,
            sprocket: 17,
            chainring: 39,
            gears: [2.533, 1.900, 1.591, 1.391, 1.250, 1.154],
            tyre: 1960
        },
        {
            model: "Ninja ZX-6R 636 (13-18)",
            primary: 1.900,
            sprocket: 16,
            chainring: 46,
            gears: [2.846, 2.200, 1.850, 1.600, 1.421, 1.300],
            tyre: 1960
        },
        {
            model: "Z900 (17-24)",
            primary: 1.627,
            sprocket: 15,
            chainring: 44,
            gears: [2.692, 2.059, 1.650, 1.409, 1.222, 1.034],
            tyre: 1960
        }
    ],
    "BMW": [
        {
            model: "S1000RR (19-20)",
            primary: 1.652,
            sprocket: 17,
            chainring: 45,
            gears: [2.647, 2.091, 1.727, 1.500, 1.360, 1.261],
            tyre: 1960
        },
        {
            model: "S1000RR (21-23)",
            primary: 1.652,
            sprocket: 17,
            chainring: 46,
            gears: [2.647, 2.091, 1.727, 1.500, 1.360, 1.261],
            tyre: 1960
        }
    ],
    "Ducati": [
        {
            model: "Panigale V4 (18-21)",
            primary: 1.800,
            sprocket: 16,
            chainring: 41,
            gears: [2.714, 2.117, 1.737, 1.524, 1.364, 1.250],
            tyre: 1960
        },
        {
            model: "Panigale V4 (22-23)",
            primary: 1.800,
            sprocket: 16,
            chainring: 41,
            gears: [2.400, 2.000, 1.737, 1.524, 1.364, 1.227],
            tyre: 1960
        }
    ]
};

export default {
    getMakes() {
        return Object.keys(GEARING_DATABASE);
    },
    getModels(make) {
        return GEARING_DATABASE[make] || [];
    },
    findData(make, modelName) {
        const models = GEARING_DATABASE[make] || [];
        return models.find(m => m.model === modelName);
    }
};
