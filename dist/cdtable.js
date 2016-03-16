/*!
 * cdtable v1.0.0
 * Copyright 2016-2016 gaochao
 * Licensed under the MIT license
 */
(function () {
  // 定义几个基础的布局layout
  var TPL_CD_LAYOUT  = [
    '<div data-cd-container="plugin-top"></div>',
    '<div class="cdtable-table-container" data-cd-container="table"></div>',
    '<div data-cd-container="plugin-bottom"></div>'
  ]

  var TPL_CD_EMPTY = '<div class="cdtable-table-empty">没有数据，重新查询</div>';

  var STAT_LOADING = 'STATE_LOADING';
  var STAT_LOADED = 'STAT_LOADED';

  var CdTable = function (option, el) {
    var self = this;
    this.option = option;
    this.$el = $(el).addClass('cdtable-root-container');
    this._initEvent();
  }

  $.extend(CdTable.prototype, {
    /**
     * 监听事件
     */
    _initEvent: function () {
      var self = this;

      self.$el.on('cdtable.reflow', function () {
        self.getTable();
      });
    },

    /**
     * 初始化表格，以及 addons 的 view
     */
    _initView: function () {
      this.$el.html(TPL_CD_LAYOUT);
      this.$topPluginContainer = this.$el.find('[data-cd-container=plugin-top]');
      this.$bottomPluginContainer = this.$el.find('[data-cd-container=plugin-bottom]');
      this.$tableContainer = this.$el.find('[data-cd-container=table]');

      // 初始化
      $.each(this.addons, function () {
        this.initView();
      });
    },

    /**
     * 由 load 事件触发
     * 1. 获取基本数据、以及各个插件的数据
     * 2. 通过 getUrl 获取请求地址
     * 3. 获取 json 数据，并进行渲染
     */
    getTable: function () {
      var self = this;

      // 如果正在请求暂停上一次的数据获取
      if (self._isLoading()) {
        self.ajaxInstance.abort();
      }

      // 拼装插件配置
      var urlData = {};
      $.each(this.addons, function (key) {
        urlData[key] = this.getAddonData();
      });

      var url = self.option.getUrl(urlData);

      if (self._validateUrl(url)) {
        self.ajaxInstance = self.option.getAjaxData ? self.option.getAjaxData(url)
          : self._getAjaxData(url);

        self._startLoading();

        // 成功回调处理
        self.ajaxInstance.done(function (json) {
          var rowData = self.option.getRowsData(json);

          self._endLoading(json);

          if (rowData && rowData.length) {
            self._render(rowData, json);
          } else {
            self._renderEmpty();
          }
        });
      }
    },

    /**
     * 渲染数据为空的情况
     */
    _renderEmpty: function () {
      this.$tableContainer.html(this.option.empty ? this.option.empty() : TPL_CD_EMPTY);
    },

    /**
     * 返回 ajax 对象，可以被 option 中的 getAjaxData 所替换，依照用户设置加入各种其他 ajax 参数
     */
    _getAjaxData: function (url) {
      return $.ajax({
        url: url
      });
    },

    /**
     * 判断是否正在获取数据
     */
    _isLoading: function () {
      return this.__load_state == STAT_LOADING;
    },
    
    /**
     * 开始获取数据
     */
    _startLoading: function () {
      this.__load_state = STAT_LOADING;
      this.$el.addClass('loading');
      this.$el.trigger('cdtable.startloading');

      window.scrollTo(0, this.$el.offset().top - 10);
    },

    /**
     * 结束获取
     */
    _endLoading: function (json) {
      var e = $.Event('cdtable.endloading', {
        json: json
      });
      this.__load_state = STAT_LOADED;
      this.$el.removeClass('loading');
      this.$el.trigger(e);
    },

    /**
     * 表格主体的渲染函数
     */
    _render: function (rowData, json) {
      var self = this, 
        html;

      var tbodyStr = '';

      rowData.forEach(function (data) {
        var str = self.option.rows(data);

        tbodyStr += str;
      });

      html = ['<table class=\"' + (self.option.tableClass || '') + '\">',
        '<thead>',
          self.option.headerRow(rowData, json),
        '</thead>',
          tbodyStr,
        '<tbody>',
        '</tbody>',
      '</table>'].join("");

      self.$tableContainer.html(html);
    },

    /**
     * 验证 url 的正确性
     */
    _validateUrl: function (url) {
      return true;
    },

    /**
     * 验证一个 addon 是否符合规则
     */
    _validateAddon: function (addon) {
      var f = true;

      ['_addonName', 'initView', 'setRoot'].forEach(function (item) {
        if (addon[item] === undefined) {
          f = false;
          return false;
        } 
      });

      return f;
    },

    /**
     * 设置 table 组件的插件列表 , 设置完毕后会初始化各个 addon 的 ui
     * @param 
     */
    setAddons: function (addonsList) {
      var self = this;

      self.addons = {};

      // 初始化各个 addons
      addonsList.forEach(function (addon) {
        if (self._validateAddon(addon)) {
          addon.setRoot(self);
          self.addons[addon.getName()] = addon
        }
      });

      self._initView();

      return self;
    },

  });


  /**
   * jQuery plugin cdtable
   * 注意以下几点:
   * headerRow 函数返回的 html 数据中 td 的个数，必须与 rows 函数 td 个数一致
   * @param {object}   option 插件配置参数
   * @param {function} option.headerRow 表头回调函数，返回表头 html 
   * @param {function} option.rows 每行内容回调函数，返回没行的 html
   *
   * @param {function} option.getUrl 返回获取数据的 url 
   * eg. 
   * function (option) {
   *   var currentPage = option.pagination.current;
   *   var filterArr = option.filter.data;
   *
   *   return '/api/getList?page=' + currentPage + $.param(filterArr);
   * }
   * 
   * @param {function} option.getRowsData 获取当前 ajax 请求的 rows 数据
   * eg. 
   * function (json) {
   *   // 判断当前请求是否有数组数据，如果有则返回, 没有的话就返回 false
   *   if (json.data) {
   *     return json.data
   *   }
   * 
   *   return false
   * }
   *
   * @param {object}   option.filterSetting 筛选相关的配置参数
   * @param {bool}     option.filterSetting.enable 是否启用筛选功能
   * @param {string}   option.filterSetting.container 筛选功能的 container 
   * @param {[filterItem]} option.filterSetting.filters 筛选相关配置数组
   * eg. [{
   *   name: 'usertype',
   *   datas: [
   *     { name: '不限', value: '0' },
   *     { name: '僵尸用户', value: '1' },
   *     { name: '黄金用户', value: '2' }
   *   ]
   * }] 
   *
   * @param {object}   option.paginationSetting 翻页相关配置参数
   * @param {bool}     option.paginationSetting.enable    是否启用翻页功能
   * @param {bool}     option.paginationSetting.container 筛选功能的 container
   * @param {function} option.paginationSetting.callback  返回总页数，当前页数，每页显示个数信息
   * eg. function (json) {
   *   return {
   *     total: json.total_page_number,
   *     current: json.current_page_number,
   *     count: json.per_page_counts
   *   }
   * }
   *
   * @param {object} option.customColumn
   * @param {bool}   option.customColumn.enable 是否启用自定义列功能
   *
   */
  $.fn.cdtable = function (option) {
    if (!option) {
      return this.data('cdtable');
    }

    return this.each(function () {
      var ins = new CdTable(option, $(this));

      $(this).data('cdtable', ins);
    });
  }

  window.cdtable = {};
  window.cdtable.addons = {};
  window.cdtable.tools = {};
})();;// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(){
  var cache = {};
 
  template = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) :
     
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +
       
        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +
       
        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');");
   
    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };

  window.cdtable.template = template;
})();;/**
 * 从 jsmod ui 类库中引入分页插件
 * MIT Licensed
 * @author gaochao
 */
(function () {
    var _option;

    _option = {
        currentPage: 0,
        maxShowPage: 10,
        textLabel: ['首页', '上一页', '下一页', '尾页'],
        pageLabel: '{#0}',
        preventInitEvent: false
    };

    /**
     * 分页控件，无需写 html ，提供一个 div 节点自动生成所有的分页所需标签
     * @alias module:jsmod/ui/pagination
     * @constructor
     * @param {(dom|string)}      element                                                          分页控件的容器
     * @param {object}            option                                                           分页控件配置参数
     * @param {int}               option.pageCount                                                 一共有多少页
     * @param {int}               [option.currentPage=0]                                           当前页
     * @param {int}               [option.maxShowPage=10]                                          最多显示分页个数
     * @param {array}             [option.textLabel=new Array('首页', '上一页', '下一页', '尾页')] 几个特殊关键字
     * @param {(string|function)} [option.pageLabel={#0}]                                          字符串用 {#0} 代表当前页, 函数则取返回值作为显示。函数其参数 page 为索引计数（起始0）；而替换字符串为 page + 1
     * @param {bool}              [option.preventInitEvent=false]                                  是否阻止初始化时触发事件
     * @param {bool}              [option.allwaysShow=false]                                       是否总是显示
     * @example
     * var Pagination = require("jsmod/ui/pagination");
     *
     * // 创建实例
     * new Pagination("#page-container", {pageCount: 20});
     */
    var Pagination = function (element, option) {
        var self = this;

        self.element = $(element);
        self.option = $.extend({}, _option, option);

        self.generatePage();
    };

    Pagination.Counst = {};

    Pagination.Counst.PAGE_TPL = '' +
        '<div class="mod-page">' +
            '<% for (var i = 0; i < renderDatas.length; i++) { %>' +
                '<a href="javascript:void(0);" <% if (renderDatas[i].page !== undefined) { %> data-page="<%= renderDatas[i].page %>" <% } %> class="mod-page-item <%= renderDatas[i].className %>"><%= renderDatas[i].label %></a>' +
            '<% } %>' +
        '</div>';

    $.extend(Pagination.prototype, 
    /** @lends module:jsmod/ui/pagination.prototype */
    {
        /**
         * @private
         * @description 生成分页控件、包括html、event
         */
        generatePage: function () {
            var self = this,
                option = self.option,
                renderDatas, html;

            self.generateEvents();

            if (option.pageCount < option.maxShowPage) {
                option.maxShowPage = option.pageCount;
            }

            if (option.preventInitEvent) {
                self.setPage(option.currentPage);
            } else {
                // 异步处理是因为需要获取page对象并绑定事件
                setTimeout(function() {
                    self.setPage(option.currentPage);
                }, 0);
            }
        },
        /**
         * 手动设置当前页
         * @public
         * @param {int} page 当前页
         * @fires module:jsmod/ui/pagination#page
         */
        setPage: function(page) {
            var self = this,
                html, e;

            html = self.getHTML(self.getRenderDatas(page));
            self.element.html(html);
            e = $.Event("page", {page: self.currentPage});

            /**
             * 设置page触发的事件，重复设置相同page会触发多次事件
             * @event module:jsmod/ui/pagination#page
             * @type {object}
             * @property {int} page 当前设定的page值
             */
            $(self).trigger(e, [{page: self.currentPage}]);
        },
        /**
         * 获取当前的 page
         * @public
         */
        getPage: function () {
            return this.currentPage;
        },
        /**
         * @private
         * @description 生成事件
         */
        generateEvents: function() {
            var self = this,
                element = self.element,
                option = self.option;

            element.undelegate("click.page");
            element.delegate("[data-page]:not(.mod-page-item-disabled)", "click.page", function(e) {
                var page = $(this).data("page");

                if ($.isNumeric(page)) {
                    self.setPage(page);
                } else if (page == "+") {
                    self.setPage(self.currentPage + 1);
                } else if (page == "-") {
                    self.setPage(self.currentPage - 1);
                }

                return false;
            });
        },
        /**
         * 哎。。之前写错字母没办法了只能留着了
         * @private
         */
        destory: function () {
            this.element.undelegate("click.page");
            this.element.html("");
        },
        /**
         * 清空分页容器，移除事件
         * @public
         */
        destroy: function () {
            this.destory();
        },
        /**
         * @private
         * @description 获取HTML代码
         * @param {array} renderDatas 渲染分页的数据
         */
        getHTML: function (renderDatas) {
            var html;

            html = cdtable.template(Pagination.Counst.PAGE_TPL, {renderDatas: renderDatas});
            return html;
        },
        /**
         * @private
         * @description 获取分页渲染数据
         * @param {int} page 标示当前页
         * @return {array} renderDatas 渲染分页的数据
         */
        getRenderDatas: function (page) {
            var self = this,
                option = self.option,
                renderDatas = [],
                start, end, offsetEnd, offsetStart;

            page = parseInt(page);
            page = page < 0 ? 0 : page;
            page = page > option.pageCount - 1 ? option.pageCount - 1 : page;

            flag = parseInt(option.maxShowPage / 3); // 分页渲染当前页的标识位

            start = page - flag < 0 ? 0 : page - flag; // start 位置
            offsetEnd = page - flag < 0 ? Math.abs(page - flag) : 0; // end 的偏移

            end = page + (option.maxShowPage - flag) - 1 > option.pageCount - 1 ? option.pageCount - 1 : page + (option.maxShowPage - flag) -1; // end 位置
            offsetStart = page + (option.maxShowPage - flag) - 1 > option.pageCount - 1 ? Math.abs(page + (option.maxShowPage - flag) - 1 - (option.pageCount - 1)) : 0 // start 的偏移

            start -= offsetStart;
            end += offsetEnd;

            if (page != 0 || option.allwaysShow) {
                // 处理固定的前两个数据
                $.each(option.textLabel.slice(0, 2), function(i, label) {
                    if (i == 0 && label) {
                        renderDatas.push({
                            className: (page == 0) ? 'mod-page-item-first mod-page-item-disabled' : "mod-page-item-first",
                            label: label,
                            page: 0
                        });
                    }
                    if (i == 1 && label) {
                        renderDatas.push({
                            className: (page == 0) ? "mod-page-item-prev mod-page-item-disabled" : "mod-page-item-prev",
                            label: label,
                            page: "-"
                        });
                    }
                });   
            }

            // 处理页面信息
            for (start; start <= end; start++) {
                renderDatas.push({
                    className: start == page ? "mod-page-item-active" : "",
                    label: $.isFunction(option.pageLabel) ? option.pageLabel(start) : option.pageLabel.replace(/{#0}/g, start + 1),
                    page: start
                });
            }

            if (page != option.pageCount - 1 || option.allwaysShow) {
                // 处理固定的后两个数据
                $.each(option.textLabel.slice(2, 4), function(i, label) {
                    if (i == 0 && label) {
                        renderDatas.push({
                            className: (page == option.pageCount - 1) ? 'mod-page-item-next mod-page-item-disabled' : "mod-page-item-next",
                            label: label,
                            page: "+"
                        });
                    }
                    if (i == 1 && label) {
                        renderDatas.push({
                            className: (page == option.pageCount - 1) ? 'mod-page-item-last mod-page-item-disabled' : "mod-page-item-last",
                            label: label,
                            page: option.pageCount - 1
                        });
                    }
                });
            }

            // 设置当前页码
            self.currentPage = page;

            return renderDatas;
        }
    });

    window.cdtable.tools.Pagination = Pagination;
})();;;(function () { 
  var TPL_DATE  = '<div class="cdtable-date-container">' +
    '<input class="cdtable-date-start" name="cdtable-date-start" readonly placeholder="<%= placeholderStart %>" /> - ' +
    '<input class="cdtable-date-end" name="cdtable-date-end" readonly placeholder="<%= placeholderEnd %>" />' +
    '<a href="javascript:void(0);" class="cdtable-date-action">最大日期范围</a>' +
    '<a href="javascript:void(0);" class="cdtable-date-remove-action">清空</a>' +
  '</div>'; 

  var _option = {
    btnText: '确认',
    val: '',
    placeholderStart: '起始日期',
    placeholderEnd: '结束日期',
    startMin: '2015/12/01'
  }

  /**
   * DatePicker addon 插件依赖日历控件，依赖 datetimepicker
   * @param {object} option 日历相关参数
   * @param {string} option.container     日历功能的 container 
   * @param {object} option.start         默认查询开始日期
   * @param {object} option.end           默认查询结束日期
   * @param {string} option.startMin      开始日期的最小值
   * @param {string} [option.btnText=确认] btn 的文案
   */
  var DatePicker = function (option) {
    this.option = $.extend({}, _option, option);
  }

  $.extend(DatePicker.prototype, {
    _addonName: 'datePicker',

    getName: function () {
      return this._addonName;
    },

    /**
     * 获取存放 filter 的 container
     */
    _getContainer: function () {
      return this.option.container ? $(this.option.container) : this.root.$topPluginContainer;
    },

    /**
     * filter 的 view 渲染
     */
    initView: function () {
      var self = this;
      var $container = self._getContainer();
      $container.append($(self._getHTML()));

      this.$start = $container.find('.cdtable-date-start');
      this.$end = $container.find('.cdtable-date-end');

      this._initDatePlugin();
      this._initEvent();
    },

    /**
     * 初始化日期控件
     */
    _initDatePlugin: function () {
      var self = this;

      if (self.option.start && self.option.end) {
        self._registerDateTimePicker();
      }
    },

    _registerDateTimePicker: function (e) {
      var self = this;

      // 初始化过后不再初始化
      if (self._registedPicker) {
        return;
      }

      $.datetimepicker.setLocale('zh');

      self.$start.datetimepicker({
        minDate: self.option.startMin,
        maxDate: new Date(+new Date() - 86400000), 
        format: 'Y-m-d',
        defaultDate: new Date(+new Date() - 86400000),
        timepicker: false,
        onSelectDate: function(dp, $input) {
          if (!self.$end.val()) {
            self.$end.datetimepicker({
              value: new Date(dp.getTime() + 86400000)
            });
          }
          self._triggerChange();
        }
      });

      self.$end.datetimepicker({
        minDate: self.option.startMin,
        maxDate: new Date(),
        format: 'Y-m-d',
        defaultDate: new Date(),
        timepicker: false,
        onSelectDate: function(dp, $input) {
          if (!self.$start.val()) {
            self.$start.datetimepicker({
              value: new Date(dp.getTime() - 86400000)
            });
          }

          self._triggerChange();
        }
      });

      self._registedPicker = true;

      // 如果由点击事件创建则默认打开
      // 且进行数据的重新加载
      if (e) {
        $(e.target).datetimepicker('show');
      }
    },

    /**
     * 注册事件
     */
    _initEvent: function () {
      var self = this;

      self._getContainer().delegate('.cdtable-date-start, .cdtable-date-end', 'click', function (e) {
        self._registerDateTimePicker(e);
      });

      self._getContainer().delegate('.cdtable-date-remove-action.enable', 'click', function (e) {
        self.reset();
        self._triggerChange();
        self._getContainer().find('.cdtable-date-remove-action').removeClass('enable');
      });

      self._getContainer().delegate('.cdtable-date-action', 'click', function () {
        self.$start.datetimepicker({
          value: new Date(self.option.startMin),
          format: 'Y-m-d'
        });

        self.$end.datetimepicker({
          value: new Date(),
          format: 'Y-m-d'
        });

        self._triggerChange();
      });
    },

    _triggerChange: function () {
      this._getContainer().find('.cdtable-date-remove-action').addClass('enable');
      this.root.$el.trigger('cdtable.datepicker.change');
      this.root.$el.trigger('cdtable.reflow');
    },

    /**
     * 重置 search addon
     */
    reset: function () {
      this.$start.val("").datetimepicker('destroy');
      this.$end.val("").datetimepicker('destroy');
      this._registedPicker = false;
    },

    /**
     * 渲染 search html 数据
     */
    _getHTML: function () {
      return window.cdtable.template(TPL_DATE , this.option);
    },

    /**
     * 设置 addon 的 root 对象
     */
    setRoot: function (root) {
      this.root = root;
    },

    /**
     * 获取 addon 提供的 url 数据
     */
    getAddonData: function () {
      return {
        start: this.$start.val(),
        end: this.$end.val()
      };
    }
  });

  window.cdtable.addons.DatePicker = DatePicker;
})();;(function () { 
  var TPL_FILTER = '<div class="cdtable-filter-container">' +
    '<ul>' +
      '<% for (var i = 0; i < filters.length; i++) { %>' +
        '<li>' +
          '<span class="cdtable-filter-select-name"><%= filters[i].label %></span>' +
          '<select name=\'<%= filters[i].name %>\'>' +
            '<% for (var j = 0; j < filters[i].datas.length; j++) { %>' +
              '<option value=\'<%= filters[i].datas[j].value %>\'><%= filters[i].datas[j].name %></option>' +
            '<% } %>' +
          '</select>' +
        '</li>' +
      '<% } %>' +
    '</ul>' +
  '</div>'; 

  /**
   * @param {object}   option 筛选相关的配置参数
   * @param {string}   option.container 筛选功能的 container 
   * @param {[filterItem]} option.filters 筛选相关配置数组
   * eg. [{
   *   name: 'usertype',
   *   datas: [
   *     { name: '不限', value: '0' },
   *     { name: '僵尸用户', value: '1' },
   *     { name: '黄金用户', value: '2' }
   *   ]
   * }] 
   */
  var Filter = function (option) {
    this.option = option;

  }

  $.extend(Filter.prototype, {
    _addonName: 'filter',

    getName: function () {
      return this._addonName;
    },

    /**
     * 获取存放 filter 的 container
     */
    _getContainer: function () {
      return this.option.container ? $(this.option.container) : this.root.$topPluginContainer;
    },

    /**
     * filter 的 view 渲染
     */
    initView: function () {
      var self = this;
      var $container = self._getContainer();
      $container.append($(self._getHTML()));

      this._initEvent();
    },

    /**
     * 注册事件
     */
    _initEvent: function () {
      var self = this;

      // 发生改变立即进行重新请求
      self._getContainer().delegate('select', 'change', function () {
        self.root.$el.trigger('cdtable.filter.change');
        self.root.$el.trigger('cdtable.reflow');
      });

      self.root.$el.on('cdtable.search.change', function () {
        self.reset();
      });
    },

    /**
     * 渲染 select html 数据
     */
    _getHTML: function () {
      var filters = this.option.filters;

      return window.cdtable.template(TPL_FILTER, {filters: filters});
    },

    /**
     * 设置 addon 的 root 对象
     */
    setRoot : function (root) {
      this.root = root;
    },

    /**
     * 重置 filter 所有的 select
     */
    reset: function () {
      this._getContainer().find('select').each(function () {
        $(this).prop('selectedIndex', 0);
      });
    },

    /**
     * 获取 addon 提供的 url 数据
     */
    getAddonData: function () {
      var data = {};

      this._getContainer().find('select').each(function () {
        data[$(this).prop('name')] = $(this).val();
      });

      return data;
    }
  });

  window.cdtable.addons.Filter = Filter;
})();;(function () {
  var TPL_PA = '<div class="cdtable-pagination-container"></div>';

  /**
   * @param {object}   option            翻页相关配置参数
   * @param {bool}     option.container  翻页功能的 container
   * @param {function} option.getSetting 返回总页数，当前页数，每页显示个数信息
   * eg. function (json) {
   *   return {
   *     total: json.total_page_number,
   *     current: json.current_page_number,
   *     count: json.per_page_counts
   *   }
   * }
   */
  var Pagination = function (option) {
    this.option = option;

  }

  $.extend(Pagination.prototype, {
    _addonName: 'pagination',

    getName: function () {
      return this._addonName;
    },

    /**
     * 获取存放 addons 的 container
     */
    _getContainer: function () {
      return this.option.container ? $(this.option.container) : this.root.$bottomPluginContainer;
    },

    /**
     * addons 的 view 渲染
     */
    initView: function () {
      var self = this;

      self._getContainer().html(TPL_PA);
      self._initEvent();

      // 在完成回调时执行真正的 initView
      self.root.$el.on('cdtable.endloading', function (e) {
        self._initView(e.json);
      });
    },

    /**
     * 真正初始化分页控件的位置
     */
    _initView: function (json) {
      var self = this,
        setting = self.option.getSetting(json),
        $container = self._getContainer();

      if (!self._pageInstance && setting) {
        self._pageInstance = new window.cdtable.tools.Pagination($container.find('.cdtable-pagination-container'), {
          pageCount: setting.total,
          allwaysShow: true,
          maxShowPage: 3,
          preventInitEvent: true
        });

        $(self._pageInstance).on('page', function () {
          self.root.$el.trigger('cdtable.reflow');
        });
      }
    },

    /**
     * 注册事件
     */
    _initEvent: function () {
      var self = this;

      // filter 插件改变时需要重置分页
      self.root.$el.on('cdtable.filter.change cdtable.search.change cdtable.datepicker.change', function () {
        self.reset();
      });
    },

    /**
     * 重置 page 控件
     */
    reset: function () {
      this._pageInstance && this._pageInstance.destory();
      this._pageInstance = null;
    },

    /**
     * 渲染 select html 数据
     */
    _getHTML: function () {
      var filters = this.option.filters;

      return window.cdtable.template(TPL_FILTER, {filters: filters});
    },

    /**
     * 设置 addon 的 root 对象
     */
    setRoot : function (root) {
      this.root = root;
    },

    /**
     * 获取 addon 提供的 url 数据
     */
    getAddonData: function () {
      var page = this._pageInstance ? this._pageInstance.getPage() : 0;

      return page;
    }
  });

  window.cdtable.addons.Pagination = Pagination;
})();;(function () { 
  var TPL_SEARCH = '<div class="cdtable-search-container">' +
    '<input class="cdtable-search-input" value="<%= val %>" placeholder="<%= placeholder %>" />' +
    '<a href="javascript:void(0);" class="cdtable-search-action"><%= btnText %></a>' +
    '<p class="cdtable-search-error"></p>' +
  '</div>';

  var _option = {
    btnText: '搜索',
    val: '',
    placeholder: ''
  }

  /**
   * search addon ， 模块提供依照输入内容进行查询功能
   * @param {object} option 筛选相关的配置参数
   * @param {string} option.container 筛选功能的 container 
   * @param {string} option.placeholder   input 上 placeholder 的文案
   * @param {string} option.val           input 默认 value
   * @param {string} [option.btnText=搜索] btn 的文案
   * eg. [{
   *   name: 'usertype',
   *   datas: [
   *     { name: '不限', value: '0' },
   *     { name: '僵尸用户', value: '1' },
   *     { name: '黄金用户', value: '2' }
   *   ]
   * }] 
   */
  var Search = function (option) {
    this.option = $.extend({}, _option, option);
  }

  $.extend(Search.prototype, {
    _addonName: 'search',

    getName: function () {
      return this._addonName;
    },

    /**
     * 获取存放 filter 的 container
     */
    _getContainer: function () {
      return this.option.container ? $(this.option.container) : this.root.$topPluginContainer;
    },

    /**
     * filter 的 view 渲染
     */
    initView: function () {
      var self = this;
      var $container = self._getContainer();
      $container.append($(self._getHTML()));

      this.$input = $container.find('.cdtable-search-input');
      this.$error = $container.find('.cdtable-search-error').hide();

      this._initEvent();
    },

    /**
     * 注册事件
     */
    _initEvent: function () {
      var self = this;

      // 检索点击
      self._getContainer().delegate('.cdtable-search-action', 'click', function () {
        self.root.$el.trigger('cdtable.search.change');
        self.root.$el.trigger('cdtable.reflow');
      });

      self._getContainer().delegate('.cdtable-search-input', 'keydown', function (e) {
        if (e.keyCode == 13) {
          self.root.$el.trigger('cdtable.search.change');
          self.root.$el.trigger('cdtable.reflow');
        }
      });
    },

    /**
     * 重置 search addon
     */
    reset: function () {
      this.$input.val("");
    },

    /**
     * 渲染 search html 数据
     */
    _getHTML: function () {
      return window.cdtable.template(TPL_SEARCH, this.option);
    },

    /**
     * 设置 addon 的 root 对象
     */
    setRoot : function (root) {
      this.root = root;
    },

    /**
     * 获取 addon 提供的 url 数据
     */
    getAddonData: function () {
      return this.$input.val();
    }
  });

  window.cdtable.addons.Search = Search;
})();