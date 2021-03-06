Link.prototype.getLinkContextsFromInterpolation = function getLinkContextsFromInterpolation(el, text) {
  var expr = ['"', text, '"'].join('').replace(/(\{\{)/g, '"+(').replace(/(\}\})/g, ')+"');
  var lexer = new Lexer(expr),
    watches = lexer.getWatches(),
    that = this;
  if (lexer.filterIndex > -1) {
    throw linkError('{0} does not support filter for {1} , please use {2} instead',
      'link', 'interpolation expression', 'x-bind');
  }

  each(watches, function (watch) {
    that.addLinkContextAndSetWatch(el, watch, 'x-bind', expr);
  });
};

Link.prototype.addLinkContextAndSetWatch = function addLinkContextAndSetWatch(el, watches, directive, expr, filter) {
  var linkContext = LinkContext.create(el, watches, directive, expr, this);
  if (filter) {
    linkContext.filter = filter;
  }
  this.linkContextCollection.push(linkContext);
  this.addWatchNotify(linkContext);
  if (directive === 'x-model') {
    modelReactDispatch(linkContext);
  }
};

Link.prototype.getEventLinkContext = function getEventLinkContext(el, attrName, fn) {
  var eventLinkContext;
  var event = eventDirectiveRegex.exec(attrName)[1];
  //done: fn could be fnc name , fnc(), fnc(args..) and null(with expr)
  if (fnRegex.test(fn)) {
    // fn
    eventLinkContext = EventLinkContext.create(el, event, fn);
  }
  else if (fnCallRegex.test(fn)) {
    // fn()
    var leftBracketIndex = fn.indexOf('(');
    eventLinkContext = EventLinkContext.create(el, event, fn.slice(0, leftBracketIndex));
  }
  else if (fnCallParamsRegex.test(fn)) {
    // fn(a,b,c)
    var args = fn.match(fnCallParamsRegex)[1].split(',');
    var leftBracketIndex = fn.indexOf('(');
    eventLinkContext = EventLinkContext.create(el, event, fn.slice(0, leftBracketIndex), args);
  }
  else {
    // expr
    eventLinkContext = EventLinkContext.create(el, event, null, fn);
  }

  this.bindEventLinkContext(eventLinkContext);
};

Link.prototype.getClassLinkContext = function getClassLinkContext(el, directive, expr) {
  var
    kvPairs = expr.slice(1, -1).split(','),
    className,
    subExpr,
    spliter,
    lexer,
    watch,
    linkContext,
    that = this;

  each(kvPairs, function (kv) {
    spliter = kv.split(':');
    className = spliter[0].replace(/[\'\"]/g, ''),
      subExpr = spliter[1];

    if (isWatch(subExpr)) {
      linkContext = LinkContext.create(el, subExpr, directive, subExpr, that);
    }
    else {
      lexer = new Lexer(subExpr);
      watch = lexer.getWatches();

      each(watch, function (w) {
        linkContext = LinkContext.create(el, w, directive, subExpr, that);
      });
    }
    linkContext.className = className;
    that.linkContextCollection.push(linkContext);
    that.addWatchNotify(linkContext);
  });
};


Link.prototype.getLinkContext = function getLinkContext(el, directive, expr) {
  if (isWatch(expr)) {
    this.addLinkContextAndSetWatch(el, expr, directive, expr);
  }
  else if (isLikeJson(expr)) {
    this.getClassLinkContext(el, directive, expr);
  }
  else {
    var lexer = new Lexer(expr),
      watches = lexer.getWatches();
    if (lexer.filter) {
      expr = expr.slice(0, lexer.filterIndex);
      this.addLinkContextAndSetWatch(el, watches, directive, expr, lexer.filter);
    }
    else
      this.addLinkContextAndSetWatch(el, watches, directive, expr);
  }
};

/**
   * 1. get directives and build linkContext context info.
   * 2. when it's x-model , add form ui value change listener for 2 two-way linkContext.
   * 3. add watch fn.
   *
   *  */
Link.prototype.compileDOM = function compileDOM(el) {
  var attrs = el.attributes,
    attrName,
    attrValue,
    that = this;
  if (el.hasAttributes && el.hasAttributes()) {
    each(attrs, function (attr) {
      attrName = attr.name;
      attrValue = trim(attr.value);
      if (eventDirectiveRegex.test(attrName)) {
        // event directive
        that.getEventLinkContext(el, attrName, attrValue);
      }
      else if (directives.indexOf(attrName) > -1) {
        // ! event directive
        that.getLinkContext(el, attrName, attrValue);
      }
    });

  } else if (el.nodeType === 3) {
    var expr = trim(el.textContent);
    if (expr && /\{\{[^\}]+\}\}/.test(expr)) {
      this.getLinkContextsFromInterpolation(el, expr);
    }
  }
};

Link.prototype.compile = function compile(el) {
  var that = this;
  if (el.hasAttribute && el.hasAttribute(REPEATER)) {
    var expr = trim(el.getAttribute(REPEATER)), // var in watch
      w = expr.split(/\s+/);
    if (w.length === 3) {
      this.addLinkContextAndSetWatch(el, w[2], REPEATER, expr);
    } else {
      throw linkError('repeat only support exr like: var in array.')
    }
    el.removeAttribute(REPEATER);
    return;
  }

  if (el.hasAttribute && el.hasAttribute(VIEW)) {
    if (!this.routeEl) {
      this.routeEl = el;
      el.removeAttribute(VIEW);
      return;
    }
    else {
      throw linkError('a link context can only have on more than one x-view');
    }
  }

  this.compileDOM(el);

  each(el.childNodes, function (node) {
    that.compile(node);
  });
};
