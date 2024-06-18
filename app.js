const axios = require("axios")
const _ = require("lodash")
const fs = require("fs")
const schedule = require("node-schedule")
const express = require("express")
const favicon = require("serve-favicon")
const morgan = require("morgan")
const dayjs = require("dayjs")
const process = require("process")

const driversPath = "./assets/drivers.json"
const statsPath = "./assets/stats.json"

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

function team(teamName, year) {
    switch(teamName) {
        case "McLaren":
            return "mclaren"
            break
        case "Alpine F1 Team":
            return "alpine"
            break
        case "Mercedes":
            return "mercedes"
            break
        case "Sauber":
            if (year < 2024) {
                return "sauber"
            } else {
                return "kick"
            }
            break
        case "Haas F1 Team":
            return "haas"
            break
        case "Lotus F1":
            return "lotus"
            break
        case "Marussia":
            return "marussia"
            break
        case "Manor Marussia":
            return "marussia"
            break
        case "Renault":
            return "renault"
            break
        case "Alfa Romeo":
            return "alfa"
            break
        case "Williams":
            return "williams"
            break
        case "Aston Martin":
            return "aston"
            break
        case "Caterham":
            return "caterham"
            break
        case "Red Bull":
            return "red"
            break
        case "Toro Rosso":
            return "toro"
            break
        case "AlphaTauri":
            return "alpha"
            break
        case "Ferrari":
            return "ferrari"
            break
        case "RB F1 Team":
            return "rb"
            break
    }
}

let stats = {
    "visits": 0,
    "guesses": 0
}

let drivers = {}
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
    dotd()
    server()
})

schedule.scheduleJob("59 23 * * *", async () => {
    axios.get("https://ergast.com/api/f1/1950/driverStandings.json?limit=1000").then(async () => {
        await updateDrivers()
    }).catch(() => {
        console.log("API is unreachable! Not updating drivers...")
        drivers = JSON.parse(fs.readFileSync(driversPath))
    })
})

schedule.scheduleJob("0 0 * * *", () => {
    dotd()
})

schedule.scheduleJob("* * * * *", () => {
    processStats()
})

async function updateDrivers() {
    let newDrivers = {}
    for (let i = 2000; i <= year; i++) {
        console.log(`Scraping F1 ${i} Season...`)
        try {
            await axios.get(`http://ergast.com/api/f1/${i}/driverStandings.json?limit=1000`).then(res => {
                res.data.MRData.StandingsTable.StandingsLists[0].DriverStandings.forEach(driver => {
                    if (driver.Driver.driverId in newDrivers) {
                        newDrivers[driver.Driver.driverId].wins += parseInt(driver.wins)
                        if (newDrivers[driver.Driver.driverId].constructors[newDrivers[driver.Driver.driverId].constructors.length - 1] !== team(driver.Constructors[0].name, i) || newDrivers[driver.Driver.driverId].constructors.length === 0) newDrivers[driver.Driver.driverId].constructors.push(team(driver.Constructors[0].name, i))
                    } else if (driver.Driver.hasOwnProperty("permanentNumber")) {
                        newDrivers[driver.Driver.driverId] = {
                            "firstName": driver.Driver.givenName,
                            "lastName": driver.Driver.familyName,
                            "code": driver.Driver.code,
                            "nationality": flag[driver.Driver.nationality],
                            "constructors": [team(driver.Constructors[0].name, i)],
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
    drivers = newDrivers

    if (fs.existsSync("assets/drivers.json")) {
        console.log("Deleting drivers.json...")
        fs.unlinkSync("assets/drivers.json")
    }

    console.log(`Writing ${_.keys(drivers).length} Drivers to drivers.json...`)
    fs.writeFileSync("assets/drivers.json", JSON.stringify(drivers), (error) => {
        if (error) throw error
    })
}

function processStats(dotd = false) {
    const date = dayjs().format("YYYY-MM-DD");

    let statsFile = {};
    if (fs.existsSync(statsPath)) {
        statsFile = JSON.parse(fs.readFileSync(statsPath));
    }

    if (statsFile.hasOwnProperty(date)) {
        if (statsFile[date].visits > stats.visits) {
            statsFile[date].visits += stats.visits
            stats.visits = statsFile[date].visits
        }
        else statsFile[date].visits = stats.visits
        if (statsFile[date].guesses > stats.guesses) {
            statsFile[date].guesses += stats.guesses
            stats.guesses = statsFile[date].guesses
        }
        else statsFile[date].guesses = stats.guesses
    } else if (dotd) {
        statsFile[date] = {
            "driver": stats.driver
        }
    } else return

    fs.writeFileSync(statsPath, JSON.stringify(statsFile));
}

function dotd() {
    console.log("Selecting Driver of the Day...")
    let date = dayjs().format("YYYY-MM-DD")
    let pastDrivers = []
    let pastDates = []
    if (fs.existsSync(statsPath)) {
        let statsFile = JSON.parse(fs.readFileSync(statsPath))
        pastDates = Object.keys(statsFile)
        pastDrivers = Object.values(statsFile).map(x => x.driver).filter((x) => { return typeof x === "string"})
    }
    if (pastDrivers.length > 0 && pastDates.length > 0 && pastDates[pastDates.length - 1] === date) {
        driver = pastDrivers[pastDrivers.length - 1]
    } else {
        let newDriver = getRandomProperty(drivers)
        while (pastDrivers.slice(-14).includes(newDriver)) {
            newDriver = getRandomProperty(drivers)
        }
        driver = newDriver
    }
    stats = {
        "visits": 0,
        "guesses": 0,
        "driver": driver
    }
    processStats(true)
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
    app.use(express.static("assets", {
        setHeaders: function(res, path, stat) {
            // Set cache control headers
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }))
    app.use(favicon('assets/favicon.ico'))
    app.use(morgan("combined"))

    app.set("views", "views")
    app.set("view engine", "ejs")

    app.get("/", (req, res) => {
        res.render("index")
        stats.visits++
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
            "wins": response[5]
        })
        stats.guesses++
    })

    let port = 3000
    app.listen(port, () => {
        console.log(`Listening on port ${port}!`)
    })
}