import Big from 'big.js'

import {  PlayerChange,  } from "./sim-service.js"
import { ContactProfile, ContactTypeRollInput, FielderChanceRollInput,  HitterChange, HittingRatings, LeagueAverage, PitcherChange, PitchRatings, PowerRollInput, RollChart, ShallowDeepRollInput } from "./interfaces.js"
import { Contact, PlayResult, Position, ShallowDeep } from './enums.js'

class RollChartService {

    constructor(
    ) { }

    public getPowerRollChart(input: PowerRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let outCount = 0
        let singleCount = 0
        let doubleCount = 0
        let tripleCount = 0

        for (let i = 0; i < 1000; i++) {

            if (outCount < input.out) {
                chart.entries.set(i, PlayResult.OUT)
                outCount++
                continue
            }

            if (singleCount < input.singles) {
                chart.entries.set(i, PlayResult.SINGLE)
                singleCount++
                continue
            }

            if (doubleCount < input.doubles) {
                chart.entries.set(i, PlayResult.DOUBLE)
                doubleCount++
                continue
            }

            if (tripleCount < input.triples) {
                chart.entries.set(i, PlayResult.TRIPLE)
                tripleCount++
                continue
            }

            chart.entries.set(i, PlayResult.HR)

        }

        return chart

    }

    public getContactTypeRollChart(input: ContactTypeRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let gbCount = 0
        let fbCount = 0
        let ldCount = 0

        for (let i = 0; i < 1000; i++) {

            if (gbCount < input.groundball) {
                chart.entries.set(i, Contact.GROUNDBALL)
                gbCount++
                continue
            }

            if (fbCount < input.flyBall) {
                chart.entries.set(i, Contact.FLY_BALL)
                fbCount++
                continue
            }

            if (ldCount < input.lineDrive) {
                chart.entries.set(i, Contact.LINE_DRIVE)
                ldCount++
                continue
            }

        }

        return chart

    }

    public getFielderChanceRollChart(input: FielderChanceRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let firstCount = 0
        let secondCount = 0
        let thirdCount = 0
        let catcherCount = 0
        let shortstopCount = 0
        let leftFieldCount = 0
        let centerFieldCount = 0
        let rightFieldCount = 0
        let pitcherCount = 0

        for (let i = 0; i < 100; i++) {

            if (firstCount < input.first) {
                chart.entries.set(i, Position.FIRST_BASE)
                firstCount++
                continue
            }

            if (secondCount < input.second) {
                chart.entries.set(i, Position.SECOND_BASE)
                secondCount++
                continue
            }

            if (thirdCount < input.third) {
                chart.entries.set(i, Position.THIRD_BASE)
                thirdCount++
                continue
            }

            if (catcherCount < input.catcher) {
                chart.entries.set(i, Position.CATCHER)
                catcherCount++
                continue
            }

            if (shortstopCount < input.shortstop) {
                chart.entries.set(i, Position.SHORTSTOP)
                shortstopCount++
                continue
            }

            if (leftFieldCount < input.leftField) {
                chart.entries.set(i, Position.LEFT_FIELD)
                leftFieldCount++
                continue
            }

            if (rightFieldCount < input.rightField) {
                chart.entries.set(i, Position.RIGHT_FIELD)
                rightFieldCount++
                continue
            }

            if (centerFieldCount < input.centerField) {
                chart.entries.set(i, Position.CENTER_FIELD)
                centerFieldCount++
                continue
            }

            if (pitcherCount < input.pitcher) {
                chart.entries.set(i, Position.PITCHER)
                pitcherCount++
                continue
            }

        }

        return chart

    }

    public getShallowDeepRollChart(input: ShallowDeepRollInput): RollChart {

        let chart: RollChart = {}
        chart.entries = new Map<number, string>()

        let shallowCount = 0
        let normalCount = 0
        let deepCount = 0

        for (let i = 0; i < 100; i++) {

            if (shallowCount < input.shallow) {
                chart.entries.set(i, ShallowDeep.SHALLOW)
                shallowCount++
                continue
            }

            if (normalCount < input.normal) {
                chart.entries.set(i, ShallowDeep.NORMAL)
                normalCount++
                continue
            }

            if (deepCount < input.deep) {
                chart.entries.set(i, ShallowDeep.DEEP)
                deepCount++
                continue
            }

        }

        return chart

    }

    public sortRollChart(rollChart: RollChart) {

        let values = Array.from(rollChart.entries.values())

        let item_order = ["K", "O", "H", "BB", "1B", "2B", "3B", "HR"]

        values.sort((a, b) => item_order.indexOf(a) - item_order.indexOf(b))

        for (let i = 0; i < 100; i++) {
            rollChart.entries.set(i, values[i])
        }
    }

    diffRollChart(average: RollChart, override: RollChart): RollChart {

        let result: RollChart = {}
        result.entries = new Map<number, string>()

        for (let i = 0; i < average.entries.size; i++) {
            if (override.entries.get(i) != average.entries.get(i)) {
                result.entries.set(i, override.entries.get(i))
            }
        }

        return result

    }

    public applyChartDiffs(hitterDiff: RollChart, pitcherDiff: RollChart, average: RollChart): RollChart {

        for (let i = 0; i < hitterDiff.entries.size; i++) {

            let chart1Value = hitterDiff.entries.get(i)
            let chart2Value = pitcherDiff.entries.get(i)

            if (chart1Value && !chart2Value) {
                average.entries.set(i, chart1Value)
            }

            if (chart2Value && !chart1Value) {
                average.entries.set(i, chart2Value)
            }
        }

        return average

    }



    //Modified from: https://stackoverflow.com/a/71534164
    incDec(index: number, by: number, array: number[]) : number[] {

        let originalTotal = array.reduce((acc, num) => acc + num, 0)


        //Clone and refer to averages because we need the original distribution to decide how to allocate excess.
        let averageArray = JSON.parse(JSON.stringify(array))

        /*
        Return a new array with the targeted number modified by >by<.
        */
        const newArr = array.map((num, idx) => idx == index ? num + by : num)


        let changePercentArray = newArr.map((num, idx) => {
            if (idx == index) return Big(0)
            return Big((averageArray[idx] + (averageArray[index] / (newArr.length - 1))) / 100)
        })


        // Return a new array that has the modified numbers.
        let updatedArray = newArr.map((num, idx) => {

            if (idx == index) {
                return Big(num)
            } else {
                return Big(num).minus(Big(by).times(changePercentArray[idx]))
            }

        })

        //Get ceil'd values
        updatedArray = updatedArray.map(b => Math.ceil(b.toPrecision(5)))

        //Check if there were rounding issues
        let total = updatedArray.reduce((acc, num) => acc + num, 0)
        let diff = originalTotal - total

        //Apply 1 to each field except the one we're changing until it hits zero
        while (Math.abs(diff) > 0) {
            for (let currentIndex = 0; currentIndex < array.length; currentIndex++) {
                if (currentIndex == index) continue

                if (diff > 0) {
                    updatedArray[currentIndex]++
                    diff--
                } else {
                    updatedArray[currentIndex]--
                    diff++
                }

                if (diff == 0) break
            }
        }

        let newTotal = updatedArray.reduce((acc, num) => acc + num, 0)
        if (newTotal != originalTotal) {
            throw new Error(`Problem with incDec ${newTotal}`)
        }

        return updatedArray
    }






    public buildHitterPowerRollInput(leagueAverage:LeagueAverage, hitterChange:HitterChange): PowerRollInput {

        //Start with league average
        let input:PowerRollInput = JSON.parse(JSON.stringify(leagueAverage.powerRollInput))

        const out = (current:number) => {

            let result = PlayerChange.applyNegativeChange(current, this._getAverage([
                hitterChange.contactChange,
                hitterChange.hrPowerChange,
                hitterChange.speedChange
            ]))

            if (result >= 0) return result
            return 0

        }

        const singles = (current:number) => {

            let result = PlayerChange.applyChange(current, this._getAverage([
                hitterChange.speedChange
            ]))

            if (result >= 0) return result
            return 0

        }

        const doubles = (current:number) => {

            let result = PlayerChange.applyChange(current, this._getAverage([
                hitterChange.speedChange,
                hitterChange.gapPowerChange,
            ]))

            if (result >= 0) return result
            return 0
        }

        const triples = (current:number) => {

            let result = PlayerChange.applyChange(current, this._getAverage([
                hitterChange.speedChange,
                hitterChange.gapPowerChange,
            ]))

            if (result >= 0) return result
            return 0

        }

        const hr = (current:number) => {

            let result = PlayerChange.applyChange(current, this._getAverage([
                hitterChange.hrPowerChange,
            ]))

            if (result >= 0) return result
            return 0

        }

        let outTotal = Math.round(out(input.out))
        let singlesTotal = Math.round(singles(input.singles))
        let doublesTotal = Math.round(doubles(input.doubles))
        let triplesTotal = Math.round(triples(input.triples))
        let hrTotal = Math.round(hr(input.hr))


        // Ensure totals add up to 1000
        let total = outTotal + singlesTotal + doublesTotal + triplesTotal + hrTotal

        if (total > 1000) {
            // Reduce out if total is more than 1000
            outTotal -= (total - 1000)
        } else if (total < 100) {
            // Increase out if total is less than 1000
            outTotal += (1000 - total)
        }

        // Ensure outTotal does not become negative after adjustment
        outTotal = Math.max(0, outTotal)

        return {
            out: outTotal,
            singles: singlesTotal,
            doubles: doublesTotal,
            triples: triplesTotal,
            hr: hrTotal
        }

    }

    public buildPitcherPowerRollInput(leagueAverage:LeagueAverage, pitcherChange:PitcherChange): PowerRollInput {

        let input:PowerRollInput = JSON.parse(JSON.stringify(leagueAverage.powerRollInput))

        const out = (current:number) => {

            let result = PlayerChange.applyChange(current, this._getAverage([
                pitcherChange.powerChange,
                pitcherChange.movementChange,
                pitcherChange.controlChange
            ]))

            if (result >= 0) return result
            return 0
        }

        const singles = (current:number) => {

            let result = PlayerChange.applyNegativeChange(current, this._getAverage([
                pitcherChange.powerChange,
                pitcherChange.movementChange,
                pitcherChange.controlChange
            ]))

            if (result >= 0) return result
            return 0

        }

        const doubles = (current:number) => {

            let result = PlayerChange.applyNegativeChange(current, this._getAverage([
                pitcherChange.powerChange,
                pitcherChange.movementChange,
                pitcherChange.controlChange
            ]))

            if (result >= 0) return result
            return 0

        }

        const triples = (current:number) => {

            let result = PlayerChange.applyNegativeChange(current, this._getAverage([
                pitcherChange.powerChange,
                pitcherChange.movementChange,
                pitcherChange.controlChange
            ]))

            if (result >= 0) return result
            return 0

        }

        const hr = (current:number) => {

            let result = PlayerChange.applyNegativeChange(current, this._getAverage([
                pitcherChange.powerChange,
                pitcherChange.movementChange,
                pitcherChange.controlChange
            ]))

            if (result >= 0) return result
            return 0

        }


        let outTotal = Math.round(out(input.out))
        let singlesTotal = Math.round(singles(input.singles))
        let doublesTotal = Math.round(doubles(input.doubles))
        let triplesTotal = Math.round(triples(input.triples))
        let hrTotal = Math.round(hr(input.hr))


        // Ensure totals add up to 1000
        let total = outTotal + singlesTotal + doublesTotal + triplesTotal + hrTotal

        if (total > 1000) {
            // Reduce out if total is more than 100
            outTotal -= (total - 1000)
        } else if (total < 1000) {
            // Increase out if total is less than 100
            outTotal += (1000 - total)
        }

        // Ensure outTotal does not become negative after adjustment
        outTotal = Math.max(0, outTotal)

        return {
            out: outTotal,
            singles: singlesTotal,
            doubles: doublesTotal,
            triples: triplesTotal,
            hr: hrTotal
        }

    }

    updatePowerRollInput(input: PowerRollInput, field: string, value: number) {

        let inputArray: number[] = []

        inputArray.push(input.out)
        inputArray.push(input.singles)
        inputArray.push(input.doubles)
        inputArray.push(input.triples)
        inputArray.push(input.hr)

        let index:number

        switch(field) {
            case "out":
                index = 0
                break
            case "singles":
                index = 1
                break
            case "doubles":
                index = 2
                break            
            case "triples":
                index = 3
                break
            case "hr":
                index = 4
                break
        }

        let result = this.incDec(index, value - input[field], inputArray)

        input.out = result[0]
        input.singles = result[1]
        input.doubles = result[2]
        input.triples = result[3]
        input.hr = result[4]

    }

    updateContactTypeInput(input: ContactTypeRollInput, field: string, value: number) {

        let inputArray: number[] = []

        inputArray.push(input.flyBall)
        inputArray.push(input.groundball)
        inputArray.push(input.lineDrive)

        let index:number 

        switch(field) {
            case "flyBall":
                index = 0
                break
            case "groundball":
                index = 1
                break
            case "lineDrive":
                index = 2
                break            
        }


        let result = this.incDec(index, value - input[field], inputArray)

        input.flyBall = result[0]
        input.groundball = result[1]
        input.lineDrive = result[2]

    }

    getMatchupPowerRollChart(leagueAverage:LeagueAverage, hitterChange:HitterChange, pitcherChange:PitcherChange, applyPlayerChanges:boolean) : RollChart {

        let leagueAvgChart: RollChart = this.getPowerRollChart(leagueAverage.powerRollInput)

        if (!applyPlayerChanges) return leagueAvgChart

        let hitter:RollChart = this.getPowerRollChart(this.buildHitterPowerRollInput(leagueAverage, hitterChange))
        let pitcher:RollChart = this.getPowerRollChart(this.buildPitcherPowerRollInput(leagueAverage, pitcherChange))

        let hitterDiffChart: RollChart = this.diffRollChart(leagueAvgChart, hitter)
        let pitcherDiffChart: RollChart = this.diffRollChart(leagueAvgChart, pitcher)

        return this.applyChartDiffs(hitterDiffChart, pitcherDiffChart, leagueAvgChart)

    }

    getMatchupContactRollChart(leagueAverage:LeagueAverage, hitterContactProfile:ContactProfile, pitcherContactProfile:ContactProfile, applyPlayerChanges:boolean): RollChart {

        let leagueAvgChart: RollChart = this.getContactTypeRollChart(leagueAverage.contactTypeRollInput)

        if (!applyPlayerChanges) return leagueAvgChart

        let hitter:RollChart = this.getContactTypeRollChart(hitterContactProfile)
        let pitcher:RollChart = this.getContactTypeRollChart(pitcherContactProfile)

        let hitterDiffChart: RollChart = this.diffRollChart(leagueAvgChart, hitter)
        let pitcherDiffChart: RollChart = this.diffRollChart(leagueAvgChart, pitcher)

        return this.applyChartDiffs(hitterDiffChart, pitcherDiffChart, leagueAvgChart)

    }



    private _getAverage(array: number[]) {
        if (array.length == 0) return 0
        return array.reduce((a, b) => a + b) / array.length
    }

}

export { RollChartService }