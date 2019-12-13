const { buildSchema, isObjectType, isWrappingType } = require("graphql")
const _get = require("lodash.get")
const _set = require("lodash.set")

// TODO support multiple requests per config (parseConfig should return [{query, variables}, ...] ?
// TODO configure graphql endpoint and support determining schema on the fly if server supports (then memoize?)
// TODO could compact or prettify the query more
exports.FigqlParser = function(schemaText) {
  const schema = buildSchema(schemaText)

  let queries = {}, mutations = {}
  // TODO these roots could be custom named, right?
  const { Mutation, Query } = schema._typeMap
  if (Mutation) mutations = Mutation.getFields()
  if (Query) queries = Query.getFields()
  this.determineQueryType = config => {
    for (const k in config) {
      if (queries[k]) return "query"
      if (mutations[k]) return "mutation"
    }
    throw new Error("could not determine query type for config")
  }

  this.parseConfig = config => {
    let subschema
    const type = this.determineQueryType(config)
    if (type === "query") {
      subschema = schema._typeMap.Query
    } else if (type === "mutation") {
      subschema = schema._typeMap.Mutation
    } else {
      throw new Error(`unknown request type ${type}`)
    }

    const queryObject = {}
    const args = {} // fully qualified to type -- this is not variables
    let argIdx = 0

    const _processSubconfig = (subschema, subconfig, paths = []) => {
      let subschemaFields
      if (subschema.getFields) {
        subschemaFields = subschema.getFields()
      } else {
        let type = subschema.type
        while (isWrappingType(type)) type = type.ofType
        const field = schema._typeMap[type]
        subschemaFields = field.getFields()
      }
      const subschemaArgs = {}
      for (const arg of subschema.args || []) {
        subschemaArgs[arg.name] = arg
      }
      const localArgIdxByVarName = {}
      for (const k in subconfig) {
        const fqKey = [...paths, k].join(".")
        const o = subconfig[k]
        if (k[0] === "$") {
          const varName = k.slice(1)
          const subschemaArg = subschemaArgs[varName]
          if (!subschemaArg) throw new Error(`bad variable ${varName} at ${fqKey}`)
          if (o !== undefined) {
            const idx = argIdx++
            args[idx] = {type: subschemaArg.type, value: o}
            localArgIdxByVarName[varName] = idx
          }
        } else {
          _set(queryObject, fqKey, {})
          const subschemaField = subschemaFields[k]
          if (!subschemaField) throw new Error(`bad field ${k} at ${fqKey}`)
          if (typeof o === "object") {
            _processSubconfig(subschemaField, o, [...paths, k])
          } else if (o) {
            // TODO check it is not object type
          }
        }
      }
      if (Object.keys(localArgIdxByVarName).length) {
        const pathsCopy = [...paths]
        const oldKey = pathsCopy.pop()
        const parent = pathsCopy.length ? _get(queryObject, pathsCopy) : queryObject
        const argChunks = []
        for (const varName in localArgIdxByVarName) {
          const idx = localArgIdxByVarName[varName]
          argChunks.push(`${varName}:$_${idx}`)
        }
        const newKey = `${oldKey}(${argChunks.join(",")})`
        const child = parent[oldKey]
        delete parent[oldKey]
        parent[newKey] = child
      }
    }
    _processSubconfig(subschema, config)

    const _writeSubQuery = (subQueryObject, indent = 1) => {
      let query = ""
      for (const k in subQueryObject) {
        for (let i = 0; i < indent; i++) query += "  "
        const o = subQueryObject[k]
        if (Object.keys(o).length) {
          query += `${k} {\n`
          query += _writeSubQuery(o, indent+1)
          for (let i = 0; i < indent; i++) query += "  "
          query += "}\n"
        } else {
          query += `${k}\n`
        }
      }
      return query
    }
    const _writeQuery = (type, argChunks, queryObject) => {
      let query = `${type}${argChunks.length ? `(${argChunks.join(",")})` : ""} {\n`
      query += _writeSubQuery(queryObject)
      query += "}"
      return query
    }

    const variables = {}
    const argChunks = []
    for (const idx in args) {
      const arg = args[idx]
      argChunks.push(`$_${idx}:${arg.type}`)
      variables[`_${idx}`] = arg.value
    }
    const query = _writeQuery(type, argChunks, queryObject)

    return { query, variables }
  }
}
