import { strict as assert } from "assert"

import { describe, it } from "mocha"

import {
    GameMessageService
} from "../src/presentation/services/game-message-service.js"

import type {
    GameMessage
} from "../src/presentation/services/game-message-service.js"


describe("GameMessageService", function () {

    it("returns all messages when there are no existing messages", function () {
        const service = new GameMessageService()

        const allMessages = [
            buildMessage("First"),
            buildMessage("Second")
        ]

        const result = service.getSync([], allMessages)

        assert.equal(result.clear, false)
        assert.deepEqual(result.messages, allMessages)
    })

    it("returns only messages that have not already been shown", function () {
        const service = new GameMessageService()

        const first = buildMessage("First")
        const second = buildMessage("Second")
        const third = buildMessage("Third")

        const result = service.getSync(
            [
                first,
                second
            ],
            [
                first,
                second,
                third
            ]
        )

        assert.equal(result.clear, false)
        assert.deepEqual(result.messages, [third])
    })

    it("returns no new messages when the lists are identical", function () {
        const service = new GameMessageService()

        const messages = [
            buildMessage("First"),
            buildMessage("Second")
        ]

        const result = service.getSync(
            messages,
            messages
        )

        assert.equal(result.clear, false)
        assert.deepEqual(result.messages, [])
    })

    it("clears and returns all messages when the first message changes", function () {
        const service = new GameMessageService()

        const result = service.getSync(
            [
                buildMessage("Old first"),
                buildMessage("Old second")
            ],
            [
                buildMessage("New first"),
                buildMessage("New second")
            ]
        )

        assert.equal(result.clear, true)

        assert.deepEqual(
            result.messages,
            [
                buildMessage("New first"),
                buildMessage("New second")
            ]
        )
    })

    it("clears when the first message type changes", function () {
        const service = new GameMessageService()

        const result = service.getSync(
            [
                buildMessage("Same text", "received")
            ],
            [
                buildMessage("Same text", "result")
            ]
        )

        assert.equal(result.clear, true)
        assert.deepEqual(result.messages, [buildMessage("Same text", "result")])
    })

    it("does not clear when the first messages match", function () {
        const service = new GameMessageService()

        const result = service.getSync(
            [
                buildMessage("First")
            ],
            [
                buildMessage("First"),
                buildMessage("Second")
            ]
        )

        assert.equal(result.clear, false)
        assert.deepEqual(result.messages, [buildMessage("Second")])
    })

    it("returns messages beginning with the first mismatch", function () {
        const service = new GameMessageService()

        const existingMessages = [
            buildMessage("First"),
            buildMessage("Second"),
            buildMessage("Old third")
        ]

        const allMessages = [
            buildMessage("First"),
            buildMessage("Second"),
            buildMessage("New third"),
            buildMessage("Fourth")
        ]

        assert.deepEqual(
            service.getNewMessages(existingMessages, allMessages),
            [
                buildMessage("New third"),
                buildMessage("Fourth")
            ]
        )
    })

    it("compares both text and type when finding new messages", function () {
        const service = new GameMessageService()

        const existingMessages = [
            buildMessage("First", "received"),
            buildMessage("Second", "received")
        ]

        const allMessages = [
            buildMessage("First", "received"),
            buildMessage("Second", "result"),
            buildMessage("Third", "received")
        ]

        assert.deepEqual(
            service.getNewMessages(existingMessages, allMessages),
            [
                buildMessage("Second", "result"),
                buildMessage("Third", "received")
            ]
        )
    })

    it("returns no new messages when allMessages is empty", function () {
        const service = new GameMessageService()

        assert.deepEqual(
            service.getNewMessages(
                [
                    buildMessage("Existing")
                ],
                []
            ),
            []
        )
    })

    it("clears when existing messages remain but the new message list is empty", function () {
        const service = new GameMessageService()

        const result = service.getSync(
            [
                buildMessage("Existing")
            ],
            []
        )

        assert.equal(result.clear, true)
        assert.deepEqual(result.messages, [])
    })

})


function buildMessage(text: string, type = "received"): GameMessage {
    return {
        text,
        type
    }
}