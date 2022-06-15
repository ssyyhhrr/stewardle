const axios = require("axios")
const _ = require("lodash")
const fs = require("fs")
const schedule = require("node-schedule")
const { mainModule } = require("process")

let drivers = {}
let driver

let year = new Date().getFullYear()

main()

async function main() {
    await updateDrivers()
    dotd()
}

async function updateDrivers() {
    if (fs.existsSync("drivers.json")) {
        console.log("Deleting drivers.json...")
        fs.unlinkSync("drivers.json")
    }

    for (let i = 1950; i <= year; i++) {
        console.log(`Scraping F1 ${i} Season...`)
        await axios.get(`http://ergast.com/api/f1/${i}/driverStandings.json?limit=1000`).then(res => {
            res.data.MRData.StandingsTable.StandingsLists[0].DriverStandings.forEach(driver => {
                if (driver.Driver.driverId in drivers) {
                    drivers[driver.Driver.driverId].wins += parseInt(driver.wins)
                    drivers[driver.Driver.driverId].constructor = driver.Constructors[0].name
                } else if (driver.Driver.hasOwnProperty("permanentNumber")) {
                    drivers[driver.Driver.driverId] = {
                        "permanentNumber": driver.Driver.permanentNumber,
                        "firstName": driver.Driver.givenName,
                        "lastName": driver.Driver.familyName,
                        "firstYear": i,
                        "nationality": driver.Driver.nationality,
                        "constructor": driver.Constructors[0].name,
                        "wins": parseInt(driver.wins)
                    }
                }
            })
        })
    }

    console.log(`Writing ${_.keys(drivers).length} Drivers to drivers.json...`)
    fs.writeFileSync("drivers.json", JSON.stringify(drivers), (error) => {
        if (error) throw error
    })
}

function dotd() {
    console.log("Selecting Driver of the Day...")
    driver = getRandomProperty(drivers)
    console.log(`Driver of the Day is ${driver}!`)
    console.log(drivers[driver])
    if (fs.existsSync("driver.txt")) {
        console.log("Deleting driver.txt...")
        fs.unlinkSync("driver.txt")
    }
    console.log(`Writing ${driver} to driver.txt...`)
    fs.writeFileSync("driver.txt", driver, (error) => {
        if (error) throw error
    })
}

function getRandomProperty(obj) {
    let keys = Object.keys(obj)
    return keys[Math.floor(Math.random() * keys.length)]
}

schedule.scheduleJob("0 0 * * *", async () => {
    main()
})