import * as lib from "../lib/lib.js";
import SequencerAudioHelper from "../sequencer-audio-helper.js";
import Section from "./section.js";
import traits from "./traits/_traits.js";
import { SequencerFile } from "../sequencer-file.js";

class SoundSection extends Section {

    constructor(inSequence, inFile = "") {
        super(inSequence);
        this._waitUntilFinished = false;
        this._file = inFile;
        this._volume = 0.8;
        this._overrides = [];
    }

    /**
     * Adds a function that will run at the end of the sound serialization step, but before it is played. Allows direct
     * modifications of sound's data. For example, it could be manipulated to change which file will be used based
     * on the distance to the target.
     *
     * @param {function} inFunc
     * @returns {SoundSection}
     */
    addOverride(inFunc) {
        if (!lib.is_function(inFunc)) throw this.sequence._customError(this, "addOverride", "The given function needs to be an actual function.");
        this._overrides.push(inFunc);
        return this;
    }

    _applyTraits() {
        Object.assign(this.constructor.prototype, traits.files);
        Object.assign(this.constructor.prototype, traits.audio);
        Object.assign(this.constructor.prototype, traits.time);
        Object.assign(this.constructor.prototype, traits.users);
    }

    async run() {
        let { play, ...data } = await this._sanitizeSoundData();

        if (!play) {
            this.sequence._showWarning(this, "Play", `File not found: ${data.src}`);
            return new Promise((reject) => reject());
        }

        Hooks.call("preCreateSequencerSound", data);

        let push = !(data.users.length === 1 && data.users.includes(game.userId));
        return SequencerAudioHelper.play(data, push);
    }

    async _sanitizeSoundData() {

        let file = await this._determineFile(this._file)

        if (file instanceof SequencerFile) {
            if (file.timeRange) {
                [this._startTime, this._endTime] = file.timeRange;
                this._isRange = true;
            }
            file = file.getFile();
        }

        let soundFile = await AudioHelper.preloadSound(file);
        if (!soundFile) {
            return {
                play: false,
                src: file
            };
        }
        let duration = soundFile.duration*1000;

        let startTime = (this._startTime ? (!this._startPerc ? this._startTime : this._startTime * duration) : 0) / 1000;

        if (this._endTime) {
            duration = !this._endPerc
                ? this._isRange ? this._endTime - this._startTime : duration - this._endTime
                : this._endTime * duration;
        }

        duration += this._waitUntilFinishedDelay;

        return {
            play: true,
            src: file,
            loop: this._duration > duration,
            volume: this._volume,
            fadeIn: this._fadeInAudio,
            fadeOut: this._fadeOutAudio,
            startTime: startTime,
            duration: this._duration || duration,
            sceneId: game.user.viewedScene,
            users: Array.from(this._users)
        };
    }
}

export default SoundSection;