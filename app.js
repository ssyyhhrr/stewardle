const axios = require("axios")
const _ = require("lodash")
const fs = require("fs")

let drivers = {}

if (fs.existsSync("drivers.json")) {
    console.log("Deleting drivers.json...")
    fs.unlinkSync("drivers.json")
}

let year = new Date().getFullYear()

updateDrivers()

async function updateDrivers() {
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
    fs.writeFile("drivers.json", JSON.stringify(drivers), (error) => {
        if (error) throw error
    })
}