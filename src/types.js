/**
 * Shared domain contracts. Runtime code uses plain objects so the final userscript
 * stays dependency-free; these typedefs keep module boundaries explicit.
 *
 * @typedef {Object} ParsedFile
 * @property {string} original Original filename including extension.
 * @property {string} normalized Unicode-normalized filename.
 * @property {string} stem Filename without extension.
 * @property {string} extension Extension including the leading dot.
 * @property {{season:number, episode:number}|null} explicitEpisode
 * @property {number|null} issueNumber
 * @property {{label:string, order:number}|null} segment
 * @property {string|null} date ISO date if present.
 * @property {boolean} isSpecial
 * @property {string[]} specialKinds
 * @property {string[]} specialTerms
 * @property {string[]} releaseTags
 * @property {string[]} titleTokens
 * @property {string[]} warnings
 *
 * @typedef {Object} TmdbSeries
 * @property {number} id
 * @property {string} name
 * @property {string} originalName
 * @property {string} firstAirDate
 * @property {string[]} originCountry
 * @property {string|null} posterPath
 *
 * @typedef {Object} TmdbEpisode
 * @property {number} id
 * @property {number} seasonNumber
 * @property {number} episodeNumber
 * @property {string} name
 * @property {string[]} alternateNames
 * @property {string|null} airDate
 * @property {string} tmdbUrl
 *
 * @typedef {Object} MatchCandidate
 * @property {number} score
 * @property {'high'|'medium'|'low'|'unmatched'} confidence
 * @property {string[]} evidence
 * @property {string[]} warnings
 * @property {TmdbEpisode|null} episode
 *
 * @typedef {Object} GuangyaFile
 * @property {string} id
 * @property {string} parentId
 * @property {string} name
 * @property {string} type
 * @property {number|null} size
 * @property {string|null} modifiedAt
 * @property {Object} raw
 * @property {Object=} detail File detail returned by get_file_detail.
 * @property {string=} detailError Non-blocking detail loading error.
 *
 * @typedef {Object} RenamePlanItem
 * @property {string} fileId
 * @property {string} oldName
 * @property {string} targetName
 * @property {TmdbEpisode|null} episode
 * @property {'high'|'medium'|'low'|'unmatched'} confidence
 * @property {string[]} evidence
 * @property {string[]} warnings
 * @property {boolean} selected
 * @property {boolean} manuallyConfirmed
 *
 * @typedef {Object} ExecutionResult
 * @property {string} fileId
 * @property {'verified'|'failed'|'mismatch'|'stale'|'skipped'} status
 * @property {string} oldName
 * @property {string} targetName
 * @property {string=} message
 */

globalThis.GTR = globalThis.GTR || {};
