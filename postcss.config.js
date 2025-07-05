module.exports = {
  plugins: [
    require('postcss-px-to-viewport-8-plugin')({
      viewportWidth: 375, // 回到经典的375px基准
      viewportHeight: 667,
      unitPrecision: 3,
      viewportUnit: 'vw',
      selectorBlackList: [
        '.ignore',
        '.hairlines',
        '.fixed-size', // 新增固定尺寸类
        '.no-vw',      // 新增不转换类
        '.glass-card', // 防止卡片变形
        '.song-item',  // 防止歌曲项变形
        '.avatar'      // 防止头像变形
      ],
      minPixelValue: 1,
      mediaQuery: true,  // 改为true，转换媒体查询中的px
      replace: true,
      exclude: [/node_modules/],
      // 更精确的属性控制
      propList: [
        '*',
        '!border*',      // 不转换所有border相关属性
        '!box-shadow',   
        '!text-shadow',
        '!outline',
        '!transform',
        '!min-width',    // 不转换最小宽度
        '!max-width',    // 不转换最大宽度
        '!min-height',   // 不转换最小高度
        '!max-height'    // 不转换最大高度
      ],
      // 处理特定场景
      landscape: false,
      landscapeUnit: 'vw',
      landscapeWidth: 568
    }),
  ],
}; 