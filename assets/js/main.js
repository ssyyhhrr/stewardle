let canOpen = true
let canClose = false
let count = true

function autocomplete(inp, arr) {
    /*the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function (e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            let s1 = arr[i].split(" ")[0]
            let s2 = arr[i].split(" ")[1]
            /*check if the item starts with the same letters as the text field value:*/
            if (s1.substr(0, val.length).toUpperCase() == val.toUpperCase() || s2.substr(0, val.length).toUpperCase() == val.toUpperCase() || arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
                let first = s1.substr(0, val.length).toUpperCase() == val.toUpperCase()
                let second = s2.substr(0, val.length).toUpperCase() == val.toUpperCase()
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                if (first) {
                    b.innerHTML = "<strong>" + s1.substr(0, val.length) + "</strong>" + s1.substr(val.length) + " " + s2;
                } else if (second) {
                    b.innerHTML = s1 + " <strong>" + s2.substr(0, val.length) + "</strong>";
                    b.innerHTML += s2.substr(val.length);
                } else {
                    b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
                    b.innerHTML += arr[i].substr(val.length);
                }
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function (e) {
                    /*insert the value for the autocomplete text field:*/
                    inp.value = this.getElementsByTagName("input")[0].value;
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                    enter()
                });
                a.appendChild(b);
            }
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function (e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
                /*and simulate a click on the "active" item:*/
                if (x) x[currentFocus].click();
            }
        }
    });
    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }
    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }
    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

let driversObj = {}
let drivers = []

document.addEventListener("keyup", async function (event) {
    if (event.keyCode === 13) {
        enter()
    }
});

function enter() {
    let value = document.getElementById("myInput").value
    if (value != "") {
        let potential = 0
        let lower = 0
        let top = 0
        let comparison = 0
        let guess
        drivers.forEach(driver => {
            comparison = similarity(value, driver)
            if (comparison > lower) potential++
            if (comparison > top) {
                top = comparison
                guess = driver
            }
        })

        if (potential == 1 || document.getElementsByClassName("autocomplete-items")[0].children.length == 1 && value.replace(/[0-9]/g, '') != "") {
            if (localStorage.guesses == null) {
                let d = new Date()
                localStorage.guesses = JSON.stringify([new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0)), guess])
            }
            else {
                let guesses = JSON.parse(localStorage.guesses)
                guesses.push(guess)
                localStorage.guesses = JSON.stringify(guesses)
            }
            document.getElementById("myInput").value = ""
            var x = document.getElementsByClassName("autocomplete-items");
            for (var i = 0; i < x.length; i++) {
                x[i].parentNode.removeChild(x[i]);
            }
            submit(guess, true)
        }
        else {
            shake()
        }
    }
}

function shake() {
    let element = document.getElementById("myInput")
    element.style.removeProperty("animation")
    setTimeout(() => element.style.animation = "shake .5s", 100)
}

function pulse() {
    let element = document.getElementsByClassName("btn")[0]
    element.style.removeProperty("animation")
    setTimeout(() => element.style.animation = "pulse .3s linear 1", 100)
    setTimeout(() => document.getElementById("copied").innerText = "Copied to clipboard!", 400)
}

async function submit(guess, real) {
    localStorage.first = false
    return new Promise(async (res, rej) => {
        let obj = {}
        Object.entries(driversObj).forEach(driver => {
            if (driver[1].firstName + " " + driver[1].lastName == guess) obj = driver[1]
        })
        let frames = Array.from(document.getElementsByClassName("frame")).filter(x => x.childNodes.length == 0)
        frames[0].innerHTML = `<div class="guess text">${obj.code}</div>`
        frames[1].innerHTML = `<img class="flag" src="./flags/${Object.values(obj)[0 + 3]}.svg">`
        frames[2].innerHTML = `<img class="team" src="./logos/${Object.values(obj)[1 + 3][Object.values(obj)[1 + 3].length - 1]}.webp">`
        for (let i = 2; i < 6; i++) {
            frames[i + 1].innerHTML = `<div class="guess text">${Object.values(obj)[i + 3]}</div>`
        }
        let answer = await fetch(`${window.location.href}driver?driver=${obj.firstName + " " + obj.lastName}`)
        let json = await answer.json()
        let won = true
        Object.values(json).forEach(async (answer, index) => {
            if (answer != 1) won = false
            setTimeout(() => {
                if (answer == 0) frames[index + 1].classList.add("down")
                else if (answer == 1) frames[index + 1].classList.add("correct")
                else if (answer == 2) frames[index + 1].classList.add("up")
                else if (answer == 3) frames[index + 1].classList.add("incorrect")
                else if (answer == 4) frames[index + 1].classList.add("previous")
            }, index * 250)
        })
        if (won || Array.from(document.getElementsByClassName("frame")).filter(x => x.childNodes.length == 0).length == 0) {
            let attempts = (6 - (Array.from(document.getElementsByClassName("frame")).filter(x => x.childNodes.length == 0).length / 7))
            if (real) {
                if (localStorage.stats == null) {
                    localStorage.stats = JSON.stringify([0, 0, 0, 0, 0])
                }
                let stats = JSON.parse(localStorage.stats)
                stats[0]++
                if (won) {
                    stats[1]++
                    stats[3]++
                }
                else {
                    stats[2]++
                    stats[3] = 0
                }
                if (stats[3] > stats[4]) stats[4] = stats[3]
                localStorage.stats = JSON.stringify(stats)
                if (localStorage.scores == null) {
                    localStorage.scores = JSON.stringify([0, 0, 0, 0, 0, 0])
                }
                let scores = JSON.parse(localStorage.scores)
                scores[attempts - 1]++
                localStorage.scores = JSON.stringify(scores)
            }
            let stats = JSON.parse(localStorage.stats)
            let scores = JSON.parse(localStorage.scores)
            let bars = ["one", "two", "three", "four", "five", "six"]
            bars.forEach((bar, index) => {
                document.getElementById(bar).innerText = scores[index]
            })
            let highest = 0
            scores.forEach(score => {
                if (score > highest) highest = score
            })
            bars.forEach((bar, index) => {
                let width = scores[index] / highest * 100
                document.getElementById(bar).style.width = `${width}%`
                if (width == 0) document.getElementById(bar).style.backgroundColor = "#171717"
            })
            let categories = ["played", "won", "lost", "streak", "max"]
            categories.forEach((category, index) => {
                document.getElementById(category).innerText = stats[index]
            })
            let data = await fetch(`${window.location.href}winner`, {
                headers: new Headers({
                    "Authorization": "Bearer kRyX3RYMRY$&yEc8"
                })
            })
            let winner = await data.json()
            let gg = document.getElementsByClassName("input")[0]
            if (gg != null) {
                gg.classList.remove("input")
                gg.classList.add("gg")
                let greeting = won ? "Congratulations!" : "Bwoah."
                gg.innerHTML = `<h2>${greeting}</h2><div class="p"><h5>The driver was</h5><h4> ${winner.winner}!</h4></div><div class="share"><div class="btn"><i class="fa-solid fa-share"></i> Share</div></div><div class="p timer"><h3>Next Stewardle</h3></div><div class="p"><h4 id="time">00:00:00:000</h4></div>`
                document.getElementsByClassName("btn")[1].onmousedown = () => {
                    open(document.getElementsByClassName("shareScreen")[0])
                    if (count) {
                        new CountUp("played", document.getElementById("played").innerText).start()
                        new CountUp("won", document.getElementById("won").innerText).start()
                        new CountUp("lost", document.getElementById("lost").innerText).start()
                        new CountUp("streak", document.getElementById("streak").innerText).start()
                        new CountUp("max", document.getElementById("max").innerText).start()
                        count = false
                    }
                }
                setTimeout(() => {
                    let attempts = (6 - (Array.from(document.getElementsByClassName("frame")).filter(x => x.childNodes.length == 0).length / 7))
                    let gameNumber = Math.floor((Date.now() - 1655769600000) / 86400000)
                    let clipboard = `Stewardle ${gameNumber} ${attempts}/6<br><br>`
                    let x = 0
                    Array.from(document.getElementsByClassName("frame")).filter(x => x.classList.length > 1).forEach((frame, index) => {
                        if (index > 11) {
                            x++
                            if (frame.classList[1] == "down") clipboard += "??????"
                            else if (frame.classList[1] == "correct") clipboard += "????"
                            else if (frame.classList[1] == "up") clipboard += "??????"
                            else if (frame.classList[1] == "incorrect") clipboard += "????"
                            else if (frame.classList[1] == "previous") clipboard += "????"
                            if (x == 6) {
                                x = 0
                                clipboard += "<br>"
                            }
                        }
                    })
                    document.getElementById("copyable").innerHTML = clipboard
                }, 1250)
            }

            // Set the date we're counting down to
            let d = new Date()
            var countDownDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));

            // Update the count down every 1 second
            var x = setInterval(function () {

                // Get today's date and time
                var now = new Date().getTime();

                // Find the distance between now and the count down date
                var distance = countDownDate - now;

                // Time calculations for days, hours, minutes and seconds
                const millisecond = 1
                const second = 1000
                const minute = second * 60
                const hour = minute * 60
                const day = hour * 24;
                let hours = Math.trunc((distance % day) / hour)
                let minutes = Math.trunc((distance % hour) / minute)
                let seconds = Math.trunc((distance % minute) / second)
                let milliseconds = secondsLeft = Math.trunc((distance % second) / millisecond)

                // Display the result in the element with id="demo"
                document.getElementById("time").innerHTML = ("0" + hours).slice(-2) + ":"
                    + ("0" + minutes).slice(-2) + ":" + ("0" + seconds).slice(-2) + ":" + ("00" + milliseconds).slice(-3);

                // If the count down is finished, write some text
                if (distance < 0) {
                    clearInterval(x);
                    document.getElementById("time").innerHTML = "EXPIRED";
                }
            }, 1);
        }
        res()
    })
}

function similarity(s1, s2) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longer.toLowerCase().includes(shorter.toLowerCase())) ? (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength) : 0;
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue),
                            costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

document.getElementsByClassName("backdrop")[0].onmousedown = () => {
    close(document.getElementsByClassName("tutorial")[0])
}

document.getElementsByClassName("close")[0].onmousedown = () => {
    close(document.getElementsByClassName("tutorial")[0])
}

document.getElementsByClassName("closeShare")[0].onmousedown = () => {
    close(document.getElementsByClassName("shareScreen")[0])
}

document.getElementsByClassName("info")[0].onmousedown = () => {
    open(document.getElementsByClassName("tutorial")[0])
}

document.getElementsByClassName("btn")[0].onmousedown = () => {
    pulse()
    copy()
}

function open(element) {
    if (!canOpen) return
    canOpen = false
    let backdrop = document.getElementsByClassName("backdrop")[0]
    backdrop.onmousedown = () => {
        close(element)
    }
    element.style.zIndex = 2
    backdrop.style.zIndex = 1
    setTimeout(() => {
        element.style.opacity = 1
        backdrop.style.opacity = 0.6
    }, 100)
    setTimeout(() => {
        canClose = true
    }, 500)
}

function close(element) {
    if (!canClose) return
    canClose = false
    let backdrop = document.getElementsByClassName("backdrop")[0]
    element.style.opacity = 0
    backdrop.style.opacity = 0
    setTimeout(() => {
        element.style.zIndex = -1
        backdrop.style.zIndex = -1
        canOpen = true
    }, 500)
}

function copy() {
    let attempts = (6 - (Array.from(document.getElementsByClassName("frame")).filter(x => x.childNodes.length == 0).length / 7))
    let gameNumber = Math.floor((Date.now() - 1655769600000) / 86400000)
    let clipboard = `Stewardle ${gameNumber} ${attempts}/6\n\n`
    let x = 0
    Array.from(document.getElementsByClassName("frame")).filter(x => x.classList.length > 1).forEach((frame, index) => {
        if (index > 11) {
            x++
            if (frame.classList[1] == "down") clipboard += "??????"
            else if (frame.classList[1] == "correct") clipboard += "????"
            else if (frame.classList[1] == "up") clipboard += "??????"
            else if (frame.classList[1] == "incorrect") clipboard += "????"
            else if (frame.classList[1] == "previous") clipboard += "????"
            if (x == 6) {
                x = 0
                clipboard += "\n"
            }
        }
    })
    navigator.clipboard.writeText(clipboard)
}

document.addEventListener('DOMContentLoaded', (event) => {
    fetch(`${window.location.href}/drivers.json`).then(res => {
        res.json().then(result => {
            driversObj = result
            Object.entries(result).forEach(driver => {
                drivers.push(driver[1].firstName + " " + driver[1].lastName)
            })
            autocomplete(document.getElementById("myInput"), drivers);
            if (localStorage.guesses != null) {
                let utc = new Date()
                let d = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 0, 0, 0))
                let expire = new Date(JSON.parse(localStorage.guesses)[0])
                if (expire <= d) {
                    localStorage.removeItem("guesses")
                }
                JSON.parse(localStorage.guesses).forEach(async (guess, index) => {
                    if (index > 0) await submit(guess, false)
                })
            }
            if (localStorage.first == null) open(document.getElementsByClassName("tutorial")[0])
        })
    })
    let d = new Date()
    let now = Date.now()
    let midnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0)).getTime()
    setTimeout(() => {
        alert("The Stewardle will change in 1 minute!")
    }, (midnight - 60000) - now)
    setTimeout(() => {
        location.reload()
    }, (midnight + 60000) - now)
})