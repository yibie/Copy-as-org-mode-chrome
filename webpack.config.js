const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
// const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')

const config = {
    entry: {
        background: {
            import: './src/background.ts',
            filename: 'background.js'
        },
        copy: {
            import: './src/copy.ts',
            filename: 'copy.js'
        },
        'copy-link': {
            import: './src/copy-link.ts',
            filename: 'copy-link.js'
        },
        'options_ui': {
            import: './src/options_ui/options_ui.ts',
            filename: 'options_ui.js'
        },
        'readability': {
            import: './src/readability.ts',
            filename: 'readability.js'
        },
        'html2org': {
            import: './src/html2org.ts',
            filename: 'html2org.js'
        },
        'content-script': {
            import: './src/content-script.ts',
            filename: 'content-script.js'
        }
    },
    output: {
        path: __dirname + '/dist'
    },
    optimization: {
        splitChunks: false // 防止代码被分割
    },
    target: ['webworker', 'es2020'],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            compilerOptions: {
                                target: 'es2020'
                            }
                        }
                    }
                ]
            },
            {
                test: /\.pug$/,
                // use: [
                //     // 'html-loader',
                //     'pug-html-loader'
                // ],
                use: [
                    //{
                    //    loader: 'html-loader',
                    //    options: { minimize: false }
                    //},
                    'raw-loader',
                    {
                        loader: 'pug-html-loader',
                        options: { pretty: true }
                    }
                ]
            },
            // { test: /\.styl(us)?$/, use: [ 'vue-style-loader', 'css-loader', 'stylus-loader' ] },
            { test: /\.(gif|svg|jpg|png)$/, loader: "file-loader" },

            { test: /\.css$/, use: ['style-loader', 'css-loader'] }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "jsdom": require.resolve("jsdom")
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/options_ui/options_ui.pug',
            filename: 'options_ui.html',
            chunks: ['options_ui'],
            inject: true
        }),
        //new HtmlWebpackPugPlugin({
        //
        //}),
        // new HtmlWebpackPlugin({
        //     template: './options_ui/index.pug',
        //     filename: 'options_ui.html',
        //     inject: true,
        //     chunks: ['main'],
        //     //minify: {
        //     //    sortAttributes: true,
        //     //    collapseWhitespace: false,
        //     //    collapseBooleanAttributes: true,
        //     //    removeComments: true,
        //     //    removeAttributeQuotes: false,
        //     //  }
        // }),
        new CopyPlugin({
            patterns: [
                {
                    from: 'src/options_ui/style/',
                    to: 'options_ui_style/'
                },
                {
                    from: 'src/syntaxhl/syntaxhl.css',
                    to: 'options_ui_style/syntaxhl.css'
                },
                {
                    from: 'manifest.json',
                    to: 'manifest.json'
                },
                {
                    from: 'img',
                    to: 'img'
                }
            ]
        }),
    ]
}

module.exports = (env, argv) => {
    console.log('mode =', argv.mode)
    if (argv.mode === 'development') {
        config.devtool = 'source-map';
    }

    if (argv.mode === 'production') {
        //...
    }

    // 为不同的入口点设置不同的 target
    if (config.entry.background) {
        config.entry.background.runtime = false; // 禁用运行时
    }

    return config
};
