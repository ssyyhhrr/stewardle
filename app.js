const axios = require("axios")
const _ = require("lodash")
const fs = require("fs")
const schedule = require("node-schedule")
const express = require("express")
const favicon = require("serve-favicon")
const morgan = require("morgan")
const dayjs = require("dayjs")
const process = require("process")
const {v4: uuidv4} = require("uuid")

const version = uuidv4()

const driversPath = "./assets/drivers.json"
const statsPath = "./assets/stats.json"
const driverPath = "./assets/driver.txt"
const pastPath = "./assets/past.json"

const flag = {
    "British": "gb",
    "Spanish": "es",
    "Polish": "pl",
    "Japanese": "jp",
    "Mexican": "mx",
    "Australian": "au",
    "Russian": "ru",
    "Dutch": "nl",
    "Belgian": "be",
    "Canadian": "ca",
    "New Zealander": "nz",
    "Thai": "th",
    "Finnish": "fi",
    "Brazilian": "br",
    "German": "de",
    "French": "fr",
    "Venezuelan": "ve",
    "Danish": "dk",
    "Swedish": "se",
    "American": "us",
    "Indonesian": "id",
    "Italian": "it",
    "Monegasque": "mc",
    "Chinese": "cn"
}

const team = {
    "McLaren": "mclaren",
    "Alpine F1 Team": "alpine",
    "Mercedes": "mercedes",
    "Sauber": "sauber",
    "Haas F1 Team": "haas",
    "Lotus F1": "lotus",
    "Marussia": "marussia",
    "Manor Marussia": "marussia",
    "Renault": "renault",
    "Alfa Romeo": "alfa",
    "Williams": "williams",
    "Aston Martin": "aston",
    "Caterham": "caterham",
    "Red Bull": "red",
    "Toro Rosso": "toro",
    "AlphaTauri": "alpha",
    "Ferrari": "ferrari"
}

let stats = {
    "visits": 0,
    "guesses": 0
}

let drivers = {}
let pastDrivers = []
let driver

let year = new Date().getFullYear()

axios.get("https://ergast.com/api/f1/1950/driverStandings.json?limit=1000").then(async () => {
    await updateDrivers()
}).catch(() => {
    console.log("API is unreachable! Not updating drivers...")
    if (fs.existsSync(driversPath)) {
        let data = fs.readFileSync(driversPath)
        drivers = JSON.parse(data)
    } else {
        throw "Ergast API is unreachable and the drivers.json cache has not been built. Please try again when the Ergast API is online."
    }
}).catch(err => {
    console.log(err)
    return process.exit(1)
}).then(() => {
    dotd(true)
    server()
})

schedule.scheduleJob("59 23 * * *", async () => {
    axios.get("https://ergast.com/api/f1/1950/driverStandings.json?limit=1000").then(async () => {
        await updateDrivers()
    }).catch(() => {
        console.log("API is unreachable! Not updating drivers...")
        let data = fs.readFileSync(driversPath)
        drivers = JSON.parse(data)
    })
    let rawStatsFile = fs.readFileSync(statsPath)
    let statsFile = JSON.parse(rawStatsFile)
    let date = dayjs().format("YYYY-MM-DD")
    statsFile[date] = stats
    let newStatsFile = JSON.stringify(statsFile)
    fs.writeFileSync(statsPath, newStatsFile)
    stats = {
        "visits": 0,
        "guesses": 0
    }
})

schedule.scheduleJob("0 0 * * *", () => {
    dotd()
})

async function updateDrivers() {
    drivers = {}
    for (let i = 2000; i <= year; i++) {
        console.log(`Scraping F1 ${i} Season...`)
        try {
            await axios.get(`http://ergast.com/api/f1/${i}/driverStandings.json?limit=1000`).then(res => {
                res.data.MRData.StandingsTable.StandingsLists[0].DriverStandings.forEach(driver => {
                    if (driver.Driver.driverId in drivers) {
                        drivers[driver.Driver.driverId].wins += parseInt(driver.wins)
                        if (drivers[driver.Driver.driverId].constructors[drivers[driver.Driver.driverId].constructors.length - 1] !== team[driver.Constructors[0].name] || drivers[driver.Driver.driverId].constructors.length === 0) drivers[driver.Driver.driverId].constructors.push(team[driver.Constructors[0].name])
                    } else if (driver.Driver.hasOwnProperty("permanentNumber")) {
                        drivers[driver.Driver.driverId] = {
                            "firstName": driver.Driver.givenName,
                            "lastName": driver.Driver.familyName,
                            "code": driver.Driver.code,
                            "nationality": flag[driver.Driver.nationality],
                            "constructors": [team[driver.Constructors[0].name]],
                            "permanentNumber": driver.Driver.permanentNumber,
                            "age": getAge(driver.Driver.dateOfBirth),
                            "firstYear": i,
                            "wins": parseInt(driver.wins),
                        }
                    }
                })
            })
        } catch (e) {
            if (i !== year) throw ""
        }
    }

    if (fs.existsSync("assets/drivers.json")) {
        console.log("Deleting drivers.json...")
        fs.unlinkSync("assets/drivers.json")
    }

    console.log(`Writing ${_.keys(drivers).length} Drivers to drivers.json...`)
    fs.writeFileSync("assets/drivers.json", JSON.stringify(drivers), (error) => {
        if (error) throw error
    })
}

function dotd(cold = false) {
    console.log("Selecting Driver of the Day...")
    if (cold && fs.existsSync(driverPath)) {
        driver = fs.readFileSync(driverPath)
    } else {
        let newDriver = getRandomProperty(drivers)
        if (pastDrivers.includes(newDriver)) {
            console.log("Driver was picked recently, re-selecting...")
            return dotd()
        }
        driver = newDriver
        pastDrivers.push(driver)
        if (pastDrivers.length > 7) pastDrivers.shift()
        fs.writeFileSync(driverPath, driver)
    }
    console.log(`Driver of the Day is ${driver}!`)
    console.log(drivers[driver])
}

function getRandomProperty(obj) {
    let keys = Object.keys(obj)
    return keys[Math.floor(Math.random() * keys.length)]
}

function getAge(dateString) {
    var today = new Date();
    var birthDate = new Date(dateString);
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function server() {
    var app = express()

    app.enable("trust proxy")

    app.use(express.urlencoded({ extended: true }))
    app.use(express.static("assets"))
    app.use(favicon('assets/favicon.ico'))
    app.use(morgan("combined"))

    app.set("views", "views")
    app.set("view engine", "ejs")

    app.get("/", (req, res) => {
        res.render("index")
        stats.visits++
    })

    app.get("/stats", (req, res) => {
        let rawStatsFile = fs.readFileSync(statsPath)
        res.json(JSON.parse(rawStatsFile))
    })

    app.get("/winner", (req, res) => {
        if (req.headers.authorization !== "Bearer kRyX3RYMRY$&yEc8") return res.end()
        res.json({
            "winner": drivers[driver].firstName + " " + drivers[driver].lastName,
        })
    })

    app.get("/driver", (req, res) => {
        if (!req.query.driver) return res.statusSend(400)
        let search = false
        let response = []
        for (let query in drivers) {
            if (req.query.driver === drivers[query].firstName + " " + drivers[query].lastName) {
                search = true
                let guess = drivers[query]
                let actual = drivers[driver]

                // nationality
                if (guess.nationality === actual.nationality) response.push(1) // correct nationality
                else response.push(3) // incorrect nationality

                // constructors
                if (guess.constructors[guess.constructors.length - 1] === actual.constructors[actual.constructors.length - 1]) response.push(1) // correct constructor
                else if (actual.constructors.includes(guess.constructors[guess.constructors.length - 1])) response.push(4) // previous constructor
                else response.push(3) // incorrect constructor

                // permanent number
                if (parseInt(guess.permanentNumber) > parseInt(actual.permanentNumber)) response.push(0) // go down
                else if (parseInt(guess.permanentNumber) === parseInt(actual.permanentNumber)) response.push(1) // stay the same
                else if (parseInt(guess.permanentNumber) < parseInt(actual.permanentNumber)) response.push(2) // go up

                // age
                if (parseInt(guess.age) > parseInt(actual.age)) response.push(0) // go down
                else if (parseInt(guess.age) === parseInt(actual.age)) response.push(1) // stay the same
                else if (parseInt(guess.age) < parseInt(actual.age)) response.push(2) // go up

                // first year
                if (parseInt(guess.firstYear) > parseInt(actual.firstYear)) response.push(0) // go down
                else if (parseInt(guess.firstYear) === parseInt(actual.firstYear)) response.push(1) // stay the same
                else if (parseInt(guess.firstYear) < parseInt(actual.firstYear)) response.push(2) // go up

                // wins
                if (parseInt(guess.wins) > parseInt(actual.wins)) response.push(0) // go down
                else if (parseInt(guess.wins) === parseInt(actual.wins)) response.push(1) // stay the same
                else if (parseInt(guess.wins) < parseInt(actual.wins)) response.push(2) // go up
            }
        }
        if (!search) return res.sendStatus(400)
        res.json({
            "nationality": response[0],
            "constructor": response[1],
            "permanentNumber": response[2],
            "age": response[3],
            "firstYear": response[4],
            "wins": response[5],
            "version": version
        })
        stats.guesses++
    })

    let port = 3000
    app.listen(port, () => {
        console.log(`Listening on port ${port}!`)
    })
}